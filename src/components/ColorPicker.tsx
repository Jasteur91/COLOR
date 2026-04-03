"use client";

import type { HSB } from "@/lib/colorScience";
import { hsbToCss } from "@/lib/colorScience";

type Props = {
  value: HSB;
  onChange: (next: HSB) => void;
  disabled?: boolean;
};

export function ColorPicker({ value, onChange, disabled }: Props) {
  const set = (patch: Partial<HSB>) =>
    onChange({
      h: patch.h ?? value.h,
      s: patch.s ?? value.s,
      b: patch.b ?? value.b,
    });

  return (
    <div className="flex flex-col gap-8">
      <div
        className="relative aspect-[4/3] w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] transition-[box-shadow,border-color] duration-[350ms]"
        style={{ backgroundColor: hsbToCss(value) }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
      </div>

      <div className="space-y-6">
        <SliderRow
          label="Teinte"
          suffix="°"
          min={0}
          max={360}
          step={1}
          value={value.h}
          onChange={(h) => set({ h })}
          accent="hue"
          disabled={disabled}
        />
        <SliderRow
          label="Saturation"
          suffix="%"
          min={0}
          max={100}
          step={1}
          value={value.s}
          onChange={(s) => set({ s })}
          accent="sat"
          disabled={disabled}
        />
        <SliderRow
          label="Luminosité"
          suffix="%"
          min={0}
          max={100}
          step={1}
          value={value.b}
          onChange={(b) => set({ b })}
          accent="bright"
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function SliderRow({
  label,
  suffix,
  min,
  max,
  step,
  value,
  onChange,
  accent,
  disabled,
}: {
  label: string;
  suffix: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  accent: "hue" | "sat" | "bright";
  disabled?: boolean;
}) {
  const track =
    accent === "hue"
      ? "bg-[linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)]"
      : accent === "sat"
        ? "bg-[linear-gradient(90deg,#808080,#ff0000)]"
        : "bg-[linear-gradient(90deg,#000,#fff)]";

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          {label}
        </span>
        <span className="font-mono text-sm tabular-nums text-[var(--foreground)]">
          {Math.round(value)}
          {suffix}
        </span>
      </div>
      <div className={`relative h-3 w-full overflow-hidden rounded-full ${track} p-0.5`}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <div
          className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--surface)] shadow-md"
          style={{ left: `${((value - min) / (max - min)) * 100}%` }}
        />
      </div>
    </div>
  );
}
