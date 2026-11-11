// ?demo=fly | hunt | base starts that one reel scene directly (fly = Take flight, hunt = Hunt, base = Build your base).
export const SCENE_IDS = ["fly", "hunt", "base"];

export function urlScene() {
  try {
    const v = new URLSearchParams(window.location.search).get("demo");
    return SCENE_IDS.includes(v) ? v : null;
  } catch { return null; }
}
