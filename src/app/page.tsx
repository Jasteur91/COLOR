import { ColorGame } from "@/components/ColorGame";
import { SplineStage } from "@/components/SplineStage";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Suspense } from "react";

function GameFallback() {
  return (
    <div className="relative z-10 flex min-h-[50vh] items-center justify-center px-6">
      <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">
        Chargement…
      </p>
    </div>
  );
}

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--background)] transition-[background-color] duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)]">
      <div className="absolute inset-0 z-0 md:left-[38%]">
        <SplineStage />
      </div>
      <div className="pointer-events-auto fixed right-6 top-6 z-[60] md:right-10 md:top-8">
        <ThemeToggle />
      </div>
      <Suspense fallback={<GameFallback />}>
        <ColorGame />
      </Suspense>
    </div>
  );
}
