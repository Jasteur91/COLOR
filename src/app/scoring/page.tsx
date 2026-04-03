import Link from "next/link";

export default function ScoringPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] px-6 py-16 text-[var(--foreground)] transition-[background-color,color] duration-[350ms] md:px-14">
      <Link
        href="/"
        className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)] hover:underline"
      >
        ← Accueil
      </Link>
      <h1 className="font-display mt-10 text-5xl font-bold tracking-tight md:text-6xl">
        Comment le score est calculé
      </h1>
      <p className="mt-4 text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
        Aligné sur dialed.gg (mise à jour avr. 2026)
      </p>

      <div className="mt-10 max-w-2xl space-y-6 text-lg leading-relaxed text-[var(--muted)]">
        <p>
          On ne compare pas seulement les curseurs. Les deux couleurs passent en
          CIELAB (espace perceptuel), puis l’écart est mesuré avec{" "}
          <strong className="font-medium text-[var(--foreground)]">CIEDE2000</strong>{" "}
          — la formule Delta E la plus utilisée en science de la couleur, qui corrige
          les biais des anciennes formules sur le vert, le bleu et le violet.
        </p>
        <p>
          Cette distance est transformée en score de jeu avec une courbe en S, puis
          des petits ajustements favorisent la bonne{" "}
          <strong className="font-medium text-[var(--foreground)]">famille de teinte</strong>{" "}
          (mémoire de la couleur).{" "}
          <strong className="font-medium text-[var(--foreground)]">Cinq manches</strong>,{" "}
          <strong className="font-medium text-[var(--foreground)]">0 à 10</strong> par
          manche, <strong className="font-medium text-[var(--foreground)]">50</strong> au
          maximum.
        </p>
      </div>

      <h2 className="font-display mt-14 text-2xl font-bold text-[var(--foreground)] md:text-3xl">
        1. Espace CIELAB
      </h2>
      <p className="mt-4 max-w-2xl text-[var(--muted)]">
        L* (luminosité), a* (vert–rouge), b* (bleu–jaune). Les deux couleurs HSB sont
        converties en RGB puis en Lab (illuminant D65, comme le jeu original).
      </p>

      <h2 className="font-display mt-10 text-2xl font-bold text-[var(--foreground)] md:text-3xl">
        2. Distance CIEDE2000
      </h2>
      <p className="mt-4 max-w-2xl text-[var(--muted)]">
        ΔE perceptuel entre les deux Lab. Indicatif : &lt; 1 imperceptible pour la
        plupart, 5–15 clairement différent, 15–50 mauvaise famille, au-delà couleurs
        sans rapport.
      </p>

      <h2 className="font-display mt-10 text-2xl font-bold text-[var(--foreground)] md:text-3xl">
        3. Courbe de base (0–10)
      </h2>
      <div className="mt-4 max-w-2xl space-y-4 font-mono text-sm text-[var(--muted)]">
        <p>
          <code className="text-[var(--foreground)]">
            base = 10 / (1 + (ΔE₀₀ / 25.25)^1.55)
          </code>
        </p>
        <p className="text-sm leading-relaxed">
          Le point milieu <span className="text-[var(--foreground)]">25.25</span> en
          CIEDE2000 remplace l’ancien 38 en CIE76 (les distances ΔE₀₀ sont plus
          petites pour la même paire). L’exposant{" "}
          <span className="text-[var(--foreground)]">1.55</span> contrôle la pente.
        </p>
      </div>

      <h2 className="font-display mt-10 text-2xl font-bold text-[var(--foreground)] md:text-3xl">
        4. Teinte — récupération et pénalité
      </h2>
      <div className="mt-4 max-w-2xl space-y-4 font-mono text-sm text-[var(--muted)]">
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          Sur les couleurs saturées, si la teinte est proche (≤ env. 25°), une partie
          des points perdus sur saturation ou luminosité peut être récupérée ; si la
          teinte est très fausse (&gt; 30°), une légère pénalité s’applique. Sur le gris
          (saturation faible), la teinte compte moins ou pas.
        </p>
        <p>
          <code className="block text-[var(--foreground)]">
            hueAccuracy = max(0, 1 − (hueDiff / 25)^1.5)
          </code>
          <code className="mt-2 block text-[var(--foreground)]">
            recovery = (10 − base) × hueAccuracy × satWeight × 0.25
          </code>
          <code className="mt-2 block text-[var(--foreground)]">
            huePenFactor = max(0, (hueDiff − 30) / 150)
          </code>
          <code className="mt-2 block text-[var(--foreground)]">
            penalty = base × huePenFactor × satWeight × 0.15
          </code>
        </p>
        <p>
          <code className="text-[var(--foreground)]">
            score = clamp(base + recovery − penalty, 0, 10)
          </code>
        </p>
      </div>

      <p className="mt-14 max-w-2xl text-sm text-[var(--muted)]">
        Référence détaillée et démo interactive :{" "}
        <a
          href="https://dialed.gg/scoring"
          className="text-[var(--foreground)] underline-offset-4 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          dialed.gg/scoring
        </a>
        . Études de design :{" "}
        <Link href="/lab" className="text-[var(--foreground)] underline-offset-4 hover:underline">
          page Lab
        </Link>{" "}
        (liens vers le site officiel).
      </p>
    </div>
  );
}
