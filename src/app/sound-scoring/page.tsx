import Link from "next/link";

export default function SoundScoringPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] px-6 py-16 text-[var(--foreground)] transition-[background-color,color] duration-[350ms] md:px-14">
      <Link
        href="/"
        className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)] hover:underline"
      >
        ← Accueil
      </Link>
      <h1 className="font-display mt-10 text-5xl font-bold tracking-tight md:text-6xl">
        Score — mode Son
      </h1>
      <p className="mt-4 text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
        Aligné sur{" "}
        <a
          href="https://dialed.gg/sound-scoring"
          className="text-[var(--foreground)] underline-offset-4 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          dialed.gg/sound-scoring
        </a>{" "}
        (v2, ERB-rate)
      </p>

      <div className="mt-10 max-w-2xl space-y-6 text-lg leading-relaxed text-[var(--muted)]">
        <p>
          Tu entends une fréquence, puis tu la retrouves avec un curseur en Hz. Le
          score ne compare pas les Hz « à la règle » : cible et essai sont convertis
          en <strong className="font-medium text-[var(--foreground)]">échelle ERB-rate</strong>
          , comme en psychoacoustique, pour que la même précision perçue donne le
          même score du grave à l’aigu.
        </p>
        <p>
          <strong className="font-medium text-[var(--foreground)]">Cinq manches</strong>
          ,{" "}
          <strong className="font-medium text-[var(--foreground)]">0 à 10</strong> par
          manche, <strong className="font-medium text-[var(--foreground)]">50</strong> max.
        </p>
      </div>

      <h2 className="font-display mt-14 text-2xl font-bold text-[var(--foreground)] md:text-3xl">
        Plages de fréquences
      </h2>
      <ul className="mt-4 max-w-2xl list-inside list-disc space-y-2 text-[var(--muted)]">
        <li>
          <strong className="text-[var(--foreground)]">Facile</strong> : 80 – 1&nbsp;200 Hz
        </li>
        <li>
          <strong className="text-[var(--foreground)]">Difficile</strong> : 60 – 1&nbsp;400 Hz
        </li>
      </ul>

      <h2 className="font-display mt-10 text-2xl font-bold text-[var(--foreground)] md:text-3xl">
        Formules (résumé)
      </h2>
      <div className="mt-4 max-w-2xl space-y-4 font-mono text-sm text-[var(--muted)]">
        <p>
          <code className="text-[var(--foreground)]">
            ERB-rate(f) = 21.4 × log₁₀(1 + 0.00437 × f)
          </code>
        </p>
        <p>
          <code className="text-[var(--foreground)]">
            dist = |ERB(cible) − ERB(essai)| / (ERB(f_max) − ERB(f_min))
          </code>
        </p>
        <p>
          Deux gaussiennes : une <strong className="text-[var(--foreground)]">précise</strong>{" "}
          (pic 10) et une <strong className="text-[var(--foreground)]">douce</strong> (pic 3) ;
          le score est le{" "}
          <strong className="text-[var(--foreground)]">maximum</strong> des deux, borné à 10 —
          comme sur le site de référence (constantes 3250 / 130).
        </p>
      </div>

      <p className="mt-14 text-sm text-[var(--muted)]">
        Le jeu démo sur cette app reprend cette logique pour le mode Son.
      </p>
    </div>
  );
}
