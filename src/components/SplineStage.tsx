"use client";

import dynamic from "next/dynamic";
import { useTheme } from "@/context/ThemeContext";
import { useMemo } from "react";

const Spline = dynamic(() => import("@splinetool/react-spline"), {
  ssr: false,
  loading: () => (
    <div className="spline-placeholder flex h-full min-h-[280px] w-full items-center justify-center bg-transparent" />
  ),
});

/** Scènes hébergées sur Spline — le texte 3D visible est défini dans l’éditeur (pas masquable en CSS). */
const SCENE_LIGHT =
  "https://prod.spline.design/abvs2mNnQSbzjq1n/scene.splinecode";
const SCENE_DARK =
  "https://prod.spline.design/X6eQECyocI2OeMH6/scene.splinecode";

export function SplineStage() {
  const { theme } = useTheme();
  const scene = theme === "dark" ? SCENE_DARK : SCENE_LIGHT;

  const key = useMemo(() => `${theme}-${scene}`, [theme, scene]);

  return (
    <div className="spline-shell pointer-events-auto absolute inset-0 overflow-hidden">
      <div
        className="spline-fade relative h-full w-full transition-opacity duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
        key={key}
      >
        <Spline
          scene={scene}
          className="!absolute inset-0 !h-full !w-full [&_canvas]:pointer-events-auto [&_canvas]:!h-full [&_canvas]:!w-full [&_canvas]:touch-manipulation"
          style={{
            width: "100%",
            height: "100%",
          }}
        />
      </div>
      {/* Dégradés : ne bloquent pas les pointeurs — interaction canvas préservée */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-24 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/80 to-transparent md:h-32"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-[2] w-16 bg-gradient-to-l from-[var(--background)] to-transparent md:w-24"
        aria-hidden
      />
    </div>
  );
}
