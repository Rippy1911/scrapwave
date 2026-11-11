import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { GAME_TITLE } from "@/game/data/tuning";
import BootSplash from "@/game/ui/BootSplash";

const GameRoot = lazy(() => import("@/game/ui/GameRoot"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${GAME_TITLE} — wasteland car combat` },
      { name: "description", content: `${GAME_TITLE}: drive, jump, wreck and loot across the Saltreach basin.` },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Black+Ops+One&family=Rajdhani:wght@500;600;700&display=swap" },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <ClientOnly fallback={<BootSplash />}>
      <Suspense fallback={<BootSplash progress={0.3} />}>
        <GameRoot />
      </Suspense>
    </ClientOnly>
  );
}