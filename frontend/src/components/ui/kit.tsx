import { type ReactNode } from "react";
import { Link } from "react-router-dom";

import { OFFER_TYPES, type OfferType } from "../../offers/offerTypes";
import { errorMessage } from "../../utils/format";
import type { Tone } from "../../utils/labels";
import { Icon } from "./Icon";
import { btn } from "./styles";

/* ---------- SEO ---------- */

export function Seo({
  title,
  description,
  jsonLd,
}: {
  title?: string;
  description?: string;
  jsonLd?: Record<string, unknown>;
}) {
  return (
    <>
      <title>{title ? `${title} · Comptoir` : "Comptoir"}</title>
      {description && <meta name="description" content={description} />}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}
    </>
  );
}

/* ---------- Formulaires ---------- */

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-muted">{hint}</span>}
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-corail/10 px-3.5 py-2.5 text-base font-medium text-corail">
      {message}
    </p>
  );
}

export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  label,
}: {
  value: number;
  min?: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="inline-flex items-center rounded-full border-2 border-nuit" role="group" aria-label={label}>
      <button
        type="button"
        className="grid h-10 w-10 place-items-center rounded-full hover:bg-nuit/10 disabled:opacity-40"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Diminuer la quantité"
      >
        <Icon name="minus" size={16} />
      </button>
      <span className="tnum min-w-8 text-center font-semibold" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="grid h-10 w-10 place-items-center rounded-full hover:bg-nuit/10 disabled:opacity-40"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Augmenter la quantité"
      >
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}

/* ---------- États ---------- */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-lg ${className}`} />;
}

export function Spinner({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-nuit/20 border-t-nuit" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: { to: string; label: string };
}) {
  return (
    <div className="mx-auto max-w-md py-14 text-center">
      <h2 className="text-2xl font-bold">{title}</h2>
      {children && <p className="mt-2 text-muted">{children}</p>}
      {action && (
        <Link to={action.to} className={btn("primary", "md", "mt-6")}>
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="mx-auto max-w-md py-14 text-center" role="alert">
      <h2 className="text-2xl font-bold">Chargement impossible</h2>
      <p className="mt-2 text-muted">{errorMessage(error)}</p>
      {onRetry && (
        <button type="button" className={btn("secondary", "md", "mt-6")} onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  );
}

export function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-4">
      <button type="button" className={btn("secondary", "sm")} onClick={() => onChange(page - 1)} disabled={page <= 1}>
        <Icon name="left" size={16} /> Précédent
      </button>
      <span className="tnum text-sm font-medium">
        Page {page} sur {pages}
      </span>
      <button
        type="button"
        className={btn("secondary", "sm")}
        onClick={() => onChange(page + 1)}
        disabled={page >= pages}
      >
        Suivant <Icon name="right" size={16} />
      </button>
    </nav>
  );
}

/* ---------- Pastilles ---------- */

const TONES: Record<Tone, string> = {
  neutral: "bg-nuit/10 text-nuit",
  good: "bg-feuille/15 text-feuille",
  warn: "bg-safran/30 text-safran-deep",
  bad: "bg-corail/15 text-corail",
  info: "bg-cobalt/10 text-cobalt",
};

export function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-semibold ${TONES[tone]}`}>{label}</span>;
}

export function TypeBadge({ type, solid = false }: { type: OfferType; solid?: boolean }) {
  const meta = OFFER_TYPES[type];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold ${solid ? meta.solid : meta.soft}`}
    >
      <Icon name={meta.icon} size={14} />
      {meta.label}
    </span>
  );
}

export function Stars({ rating, count, className = "" }: { rating: number; count: number; className?: string }) {
  if (count === 0) return <span className={`text-sm text-muted ${className}`}>Pas encore d'avis</span>;
  return (
    <span className={`inline-flex items-center gap-1 text-sm ${className}`}>
      <Icon name="star" size={16} className="text-safran" />
      <span className="tnum font-semibold">{rating.toFixed(1).replace(".", ",")}</span>
      <span className="text-muted">({count})</span>
    </span>
  );
}

export function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Note" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} sur 5`}
          onClick={() => onChange(n)}
          className={`rounded p-1 ${n <= value ? "text-safran" : "text-nuit/25"} hover:text-safran`}
        >
          <Icon name="star" size={28} />
        </button>
      ))}
    </div>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-8">
      <h1 className="text-4xl sm:text-5xl">{children}</h1>
      {sub && <p className="mt-3 max-w-prose text-lg text-muted">{sub}</p>}
    </header>
  );
}
