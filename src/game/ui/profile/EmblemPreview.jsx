import { useEffect, useRef } from "react";
import { drawEmblem } from "@/game/fame/emblemDraw";

export default function EmblemPreview({ avatar, size = 96, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, size, size);
    drawEmblem(ctx, avatar, size);
  }, [avatar, size]);
  return <canvas ref={ref} width={size} height={size} className={className} aria-hidden />;
}
