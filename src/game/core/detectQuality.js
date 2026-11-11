// Picks a starting quality preset from the device: phones/tablets and software or weak integrated GPUs get
// low/medium, desktops with a discrete-class GPU get high. Only used until the player picks a preset.
import { isMobileDevice } from "@/game/ui/touch/detect";

const WEAK = /swiftshader|llvmpipe|software|basic render|mali-[4t]|adreno \(tm\) [3-5]|powervr|intel\(r\) (hd|uhd) graphics [2-6]/i;
const MID = /intel|iris|uhd|mali|adreno|apple gpu|radeon\(tm\) graphics|vega [3-8]\b/i;

export function detectQuality() {
  // Phones and tablets (coarse pointer, or ?touch=1): Low — resolution scale 1, no shadows, less scatter,
  // capped particles; the renderer's auto scaling keeps it at 30 fps or better.
  if (isMobileDevice()) return "low";
  const touch = navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 900;
  let gpu = "";
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    gpu = "";
  }
  if (WEAK.test(gpu)) return "low";
  if (touch) return "medium";
  if (MID.test(gpu) && !/apple m[1-9]/i.test(gpu)) return "medium";
  return gpu ? "high" : "medium";
}