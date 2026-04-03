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
      <p className="mt-8 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
        Les deux couleurs (cible et ta sélection) sont converties en CIELAB, puis
        la distance perceptuelle ΔE (CIE76) est mesurée. Une courbe en S mappe
        cette distance sur 0–10 points par manche, avec ajustements pour la
        précision de teinte — comme sur{" "}
        <a
          href="https://dialed.gg/scoring"
          className="text-[var(--foreground)] underline-offset-4 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          dialed.gg
        </a>
        .
      </p>
      <div className="mt-12 max-w-2xl space-y-6 font-mono text-sm leading-relaxed text-[var(--muted)]">
        <p>
          <code className="text-[var(--foreground)]">base = 10 / (1 + (ΔE / 38)^1.6)</code>
        </p>
        <p>
          Récupération teinte et pénalité si la couleur est saturée — la teinte
          compte plus qu’un simple écart numérique.
        </p>
      </div>
    </div>
  );
}
