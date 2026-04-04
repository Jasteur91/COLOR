"use client";

import { SOUND_RANGE_HZ, type SoundDifficulty } from "@/lib/soundScoring";

type Props = {
  valueHz: number;
  onChangeHz: (hz: number) => void;
  difficulty: SoundDifficulty;
  disabled?: boolean;
  onPreview?: () => void;
};

export function FrequencyPicker({
  valueHz,
  onChangeHz,
  difficulty,
  disabled,
  onPreview,
}: Props) {
  const { min, max } = SOUND_RANGE_HZ[difficulty];

  return (
    <div className="flex flex-col gap-8">
      <div
        className="relative flex h-24 w-full max-w-md items-end justify-center gap-0.5 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-2 pb-2 pt-6"
        aria-hidden
      >
        {Array.from({ length: 48 }, (_, i) => {
          const t = i / 47;
          const f = min + t * (max - min);
          const h = 8 + (Math.log(f / min) / Math.log(max / min)) * 56;
          const active =
            valueHz >= f - (max - min) / 47 && valueHz <= f + (max - min) / 47;
          return (
            <div
              key={i}
              className={`w-1.5 min-w-0 flex-1 rounded-t-sm transition-[background-color,opacity] duration-200 ${
                active
                  ? "bg-[var(--accent)] opacity-100"
                  : "bg-[var(--border)] opacity-60"
              }`}
              style={{ height: `${h}%` }}
            />
          );
        })}
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Fréquence
          </span>
          <span className="font-mono text-lg tabular-nums text-[var(--foreground)]">
            {Math.round(valueHz)} Hz
          </span>
        </div>
        <div className="relative h-4 w-full max-w-md">
          <input
            type="range"
            min={min}
            max={max}
            step={1}
            value={valueHz}
            disabled={disabled}
            onChange={(e) => onChangeHz(Number(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
          <div className="pointer-events-none absolute inset-0 flex items-center">
            <div className="h-1.5 w-full rounded-full bg-[var(--border)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-75 ease-out"
                style={{ width: `${((valueHz - min) / (max - min)) * 100}%` }}
              />
            </div>
            <div
              className="absolute h-5 w-5 -translate-x-1/2 rounded-full border-2 border-white bg-[var(--foreground)] shadow-md"
              style={{ left: `${((valueHz - min) / (max - min)) * 100}%` }}
            />
          </div>
        </div>
        <p className="mt-2 font-mono text-[10px] text-[var(--muted)]">
          Plage {difficulty === "easy" ? "facile" : "difficile"} : {min} – {max} Hz
        </p>
      </div>

      {onPreview && (
        <button
          type="button"
          disabled={disabled}
          onClick={onPreview}
          className="w-fit rounded-full border border-[var(--border)] px-6 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)] transition-[border-color,color] duration-[350ms] hover:border-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40"
        >
          Écouter ta fréquence
        </button>
      )}
    </div>
  );
}
