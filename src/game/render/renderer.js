// Renderer, post-processing chain (pmndrs postprocessing + N8AO), quality presets and adaptive pixel ratio.
// Chain: scene -> N8AO ambient occlusion -> [heat shimmer / hit aberration / turbo radial blur, bloom (emissive only),
// AgX tone mapping, colour grade + vignette + grain] -> SMAA.
import * as THREE from "three";
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, SMAAEffect, SMAAPreset, EdgeDetectionMode,
  ToneMappingEffect, ToneMappingMode, Effect, EffectAttribute, BlendFunction,
} from "postprocessing";
import { N8AOPostPass } from "n8ao";
import { QUALITY, RENDER } from "@/game/data/tuning";
import { RC, runFrameHooks, setRenderQuality, clearRenderHooks } from "@/game/render/frame";
import { setAssetAnisotropy } from "@/game/assets/assets";

// HDR guard. The chain renders into a half-float target (max 65504). A sun glint on bare metal at a grazing angle
// (chrome bolts, glass, polished panels) can overflow it to Inf, and the mipmap bloom then smears that one pixel over
// the whole frame, which comes out black. Every built-in material ends in opaque_fragment, so cap the light there:
// 256 is far above anything lit or emissive in the game (bloom starts at 1.25).
if (!THREE.ShaderChunk.opaque_fragment.includes("swHdrCap")) {
  THREE.ShaderChunk.opaque_fragment = "outgoingLight = min(outgoingLight, vec3(256.0)); // swHdrCap\n" + THREE.ShaderChunk.opaque_fragment;
}

// Screen-space distortions on the HDR image: heat shimmer over distant ground, chromatic pulse on hits,
// radial blur while the turbo burns.
class DistortEffect extends Effect {
  constructor() {
    super("SwDistort", /* glsl */`
      uniform float uHit; uniform float uSpeed; uniform float uShimmer; uniform float uHorizon;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec2 c = uv - 0.5;
        vec2 u0 = uv;
        if (uShimmer > 0.0) {
          // a thin band just under the horizon line (distant flats), strongest at the line itself
          float d = uv.y - uHorizon;
          float k = smoothstep(-0.07, -0.005, d) * (1.0 - smoothstep(0.0, 0.012, d)) * uShimmer;
          u0 += vec2(sin(uv.y * 900.0 + time * 6.3) + sin(uv.y * 340.0 - time * 3.7), 0.4 * cos(uv.x * 260.0 + time * 4.1)) * 0.0007 * k;
        }
        vec3 col;
        if (uSpeed > 0.01) {
          float s = uSpeed * 0.04 * smoothstep(0.08, 0.55, length(c));
          vec3 acc = vec3(0.0);
          for (int i = 0; i < 6; i++) acc += texture2D(inputBuffer, u0 - c * s * float(i) / 5.0).rgb;
          col = acc / 6.0;
        } else col = texture2D(inputBuffer, u0).rgb;
        float ca = uHit * 0.011 + uSpeed * 0.0025;
        if (ca > 0.0004) {
          col.r = texture2D(inputBuffer, u0 + c * ca).r;
          col.b = texture2D(inputBuffer, u0 - c * ca).b;
        }
        outputColor = vec4(col, inputColor.a);
      }`, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([["uHit", new THREE.Uniform(0)], ["uSpeed", new THREE.Uniform(0)], ["uShimmer", new THREE.Uniform(0)], ["uHorizon", new THREE.Uniform(0.5)]]),
    });
  }
}

// Colour grade after tone mapping: warm highlights, teal shadows, gentle S-curve, vignette, film grain, hit flash, storm.
class GradeEffect extends Effect {
  constructor() {
    super("SwGrade", /* glsl */`
      uniform float uHit; uniform float uStorm; uniform float uGrain;
      float swHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 col = max(inputColor.rgb, 0.0);
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col *= mix(vec3(0.9, 0.99, 1.07), vec3(1.07, 1.0, 0.9), smoothstep(0.02, 0.5, l));
        vec3 g = pow(col, vec3(1.0 / 2.2));
        g = mix(g, g * g * (3.0 - 2.0 * g), 0.22);
        col = pow(max(g, 0.0), vec3(2.2));
        float l2 = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(vec3(l2), col, 1.1);
        col = mix(col, vec3(l2) * vec3(1.12, 0.82, 0.56), uStorm * 0.45);
        vec2 c = uv - 0.5;
        float v = smoothstep(0.95, 0.32, length(c * vec2(1.25, 1.0)));
        col *= mix(0.68, 1.0, v);
        col = mix(col, col * vec3(1.6, 0.35, 0.3), uHit * (1.0 - v) * 0.85);
        col += (swHash(uv * 731.0 + fract(time * 13.0)) - 0.5) * uGrain * (0.4 + l2);
        outputColor = vec4(max(col, 0.0), inputColor.a);
      }`, {
      blendFunction: BlendFunction.SET,
      uniforms: new Map([["uHit", new THREE.Uniform(0)], ["uStorm", new THREE.Uniform(0)], ["uGrain", new THREE.Uniform(0.018)]]),
    });
  }
}

export function createRenderer(canvas, scene, camera, qualityName = "medium") {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", stencil: false, depth: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping; // used only by the post chain's exposure uniform
  renderer.toneMappingExposure = RENDER.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false;
  setAssetAnisotropy(renderer.capabilities.getMaxAnisotropy());
  Object.assign(RC, { camera, renderer, scene });

  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
  const renderPass = new RenderPass(scene, camera);
  const distort = new DistortEffect();
  const grade = new GradeEffect();
  const B = RENDER.bloom;
  const bloom = new BloomEffect({ luminanceThreshold: B.threshold, luminanceSmoothing: B.smoothing, intensity: B.intensity, mipmapBlur: true, radius: B.radius });
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
  const smaa = new SMAAEffect({ preset: SMAAPreset.HIGH, edgeDetectionMode: EdgeDetectionMode.COLOR });
  let ao = null;

  const r = {
    renderer, composer, bloom, grade, smaa, quality: qualityName, q: QUALITY[qualityName] || QUALITY.high,
    pixelRatio: 1, maxRatio: 2, slowTime: 0, onQuality: null, stats: { calls: 0, tris: 0, ms: 0 },
    fx: { hit: 0, speed: 0 },
  };

  function build() {
    composer.removeAllPasses();
    composer.addPass(renderPass);
    const q = r.q;
    if (q.ao) {
      if (!ao) {
        ao = new N8AOPostPass(scene, camera, window.innerWidth, window.innerHeight);
        Object.assign(ao.configuration, { aoRadius: 2.6, distanceFalloff: 1.2, intensity: 2.4, gammaCorrection: false, color: new THREE.Color(0, 0, 0) });
      }
      ao.setQualityMode(q.ao >= 3 ? "High" : q.ao === 2 ? "Medium" : "Performance");
      ao.configuration.halfRes = q.ao < 3;
      composer.addPass(ao);
    }
    const effects = [distort];
    if (q.bloom) effects.push(bloom);
    effects.push(tone, grade);
    composer.addPass(new EffectPass(camera, ...effects));
    if (q.smaa) composer.addPass(new EffectPass(camera, smaa));
    distort.uniforms.get("uShimmer").value = q.shimmer ? 1 : 0;
  }

  r.resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(r.pixelRatio);
    composer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  r.setQuality = (name) => {
    r.quality = name; r.q = QUALITY[name] || QUALITY.high;
    r.maxRatio = Math.min(window.devicePixelRatio || 1, r.q.pixelRatio);
    r.pixelRatio = r.maxRatio;
    camera.far = r.q.far;
    camera.updateProjectionMatrix();
    setRenderQuality(name, r.q);
    build();
    r.resize();
    if (r.onQuality) r.onQuality(r.q);
  };

  // Drop resolution when frames take > 20 ms for 2 s.
  r.tick = (frameMs, dt) => {
    if (frameMs > 20) r.slowTime += dt; else r.slowTime = Math.max(0, r.slowTime - dt * 0.5);
    if (r.slowTime > 2 && r.pixelRatio > 1) {
      r.pixelRatio = r.pixelRatio > 1.5 ? 1.5 : 1;
      r.slowTime = 0;
      r.resize();
    }
  };

  r.setFx = ({ hit = 0, storm = 0, speed = 0 }) => {
    r.fx.hit = hit;
    r.fx.speed += (speed - r.fx.speed) * 0.08;
    distort.uniforms.get("uHit").value = Math.min(1, hit * 1.2);
    distort.uniforms.get("uSpeed").value = r.fx.speed < 0.01 ? 0 : r.fx.speed;
    grade.uniforms.get("uHit").value = hit;
    grade.uniforms.get("uStorm").value = storm;
  };

  // Photo mode for screenshots and trailers: window.scrapwakeGfx.photo({ pos: [x,y,z], look: [x,y,z], fov }) pins the
  // camera after the game has placed it; photo(null) hands it back.
  let photo = null, last = performance.now();
  const _dir = new THREE.Vector3();
  r.render = () => {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (photo) {
      // a clean frame: no hit flash or turbo smear in photos
      distort.uniforms.get("uHit").value = 0; distort.uniforms.get("uSpeed").value = 0; grade.uniforms.get("uHit").value = 0;
      camera.position.set(...photo.pos); camera.lookAt(...photo.look);
      if (photo.fov && camera.fov !== photo.fov) { camera.fov = photo.fov; camera.updateProjectionMatrix(); }
      camera.updateMatrixWorld();
    }
    runFrameHooks(dt, scene, camera);
    // screen height of the horizon for the heat shimmer band
    camera.getWorldDirection(_dir);
    const pitch = Math.asin(Math.max(-1, Math.min(1, _dir.y)));
    distort.uniforms.get("uHorizon").value = 0.5 - 0.5 * Math.tan(pitch) / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    renderer.info.reset();
    composer.render(dt);
    r.stats.calls = renderer.info.render.calls; r.stats.tris = renderer.info.render.triangles;
    r.stats.ms = r.stats.ms * 0.9 + (performance.now() - now) * 0.1;
  };
  r.dispose = () => { clearRenderHooks(scene); composer.dispose(); renderer.dispose(); };

  r.setQuality(qualityName);
  window.addEventListener("resize", r.resize);
  r.disposeResize = () => window.removeEventListener("resize", r.resize);
  window.scrapwakeGfx = { ...(window.scrapwakeGfx || {}), photo(p) { photo = p || null; return !!photo; }, renderer, scene, camera, r, stats: r.stats, quality: QUALITY };
  return r;
}
