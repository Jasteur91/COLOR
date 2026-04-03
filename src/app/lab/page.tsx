import Link from "next/link";

const studies = [
  {
    title: "Scoring & plage de couleurs",
    href: "https://dialed.gg/lab/scoring-study",
    desc: "Outil interactif sur la courbe de score, le Delta E et la génération des couleurs.",
  },
  {
    title: "CIE76 vs CIEDE2000",
    href: "https://dialed.gg/lab/scoring-comparison",
    desc: "Comparaison côte à côte, presets pour les cas limites.",
  },
  {
    title: "Son — écran résultats",
    href: "https://dialed.gg/lab/sound-results-study",
    desc: "Layouts solo / multijoueur, comparaisons.",
  },
  {
    title: "Daily — résultats & classement",
    href: "https://dialed.gg/lab/daily-screens-study",
    desc: "Style Wordle, partage, leaderboard.",
  },
] as const;

export default function LabPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] px-6 py-16 text-[var(--foreground)] transition-[background-color,color] duration-[350ms] md:px-14">
      <Link
        href="/"
        className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)] hover:underline"
      >
        ← Accueil
      </Link>
      <h1 className="font-display mt-10 text-5xl font-bold tracking-tight md:text-6xl">
        Études Lab
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
        Sur le site officiel, le Lab regroupe explorations de design, prototypes et
        études de composants — tout part d’une question. Ci-dessous, des liens vers
        les pages correspondantes sur{" "}
        <a
          href="https://dialed.gg/lab"
          className="text-[var(--foreground)] underline-offset-4 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          dialed.gg/lab
        </a>
        . Ce projet démo reprend le{" "}
        <Link href="/scoring" className="text-[var(--foreground)] underline-offset-4 hover:underline">
          scoring actuel
        </Link>{" "}
        (CIEDE2000 + ajustements teinte).
      </p>

      <ul className="mt-14 max-w-2xl space-y-6">
        {studies.map((s) => (
          <li key={s.href}>
            <a
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/60 p-6 transition-[border-color,background-color] duration-[350ms] hover:border-[var(--foreground)]/30"
            >
              <span className="font-display text-xl font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)]">
                {s.title}
                <span className="ml-2 inline-block transition-transform duration-[350ms] group-hover:translate-x-0.5">
                  →
                </span>
              </span>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{s.desc}</p>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
