import type { Offer } from "../types";

const currencyFmt = new Map<string, Intl.NumberFormat>();

export function money(value: number, currency = "EUR"): string {
  const decimals = Number.isInteger(value) ? 0 : 2;
  const key = `${currency}:${decimals}`;
  let fmt = currencyFmt.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: 2,
    });
    currencyFmt.set(key, fmt);
  }
  return fmt.format(value);
}

export function priceText(o: Pick<Offer, "price" | "price_mode" | "currency">): string {
  if (o.price_mode === "QUOTE" || o.price === null) return "Sur devis";
  const base = money(o.price, o.currency);
  return o.price_mode === "STARTING_AT" ? `À partir de ${base}` : base;
}

export function discountPercent(o: Pick<Offer, "price" | "old_price">): number | null {
  if (o.price === null || o.old_price === null || o.old_price <= o.price) return null;
  return Math.round((1 - o.price / o.old_price) * 100);
}

/** L'API renvoie parfois des dates sans fuseau (SQLite) : on les lit comme de l'UTC. */
export function toDate(iso: string): Date {
  return new Date(/([zZ]|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`);
}

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dayLongFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

export const fmtDate = (iso: string) => dateFmt.format(toDate(iso));
export const fmtDateTime = (iso: string) => dateTimeFmt.format(toDate(iso));
export const fmtTime = (iso: string) => timeFmt.format(toDate(iso));
export const fmtDayLong = (iso: string) => dayLongFmt.format(toDate(iso));

export function dayKey(iso: string): string {
  const d = toDate(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Une erreur est survenue. Réessaie dans un instant.";
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}
