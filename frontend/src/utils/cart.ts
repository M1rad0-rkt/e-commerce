import type { OfferType } from "../offers/offerTypes";
import type { Offer } from "../types";

export interface CartLine {
  key: string;
  offerId: number;
  slug: string;
  title: string;
  type: OfferType;
  price: number;
  currency: string;
  image: string | null;
  quantity: number;
  /** Plafond de quantité (stock, nombre de séances) ; 1 pour les lignes à quantité fixe. */
  maxQuantity: number;
  slotId?: number;
  slotStart?: string;
  slotEnd?: string;
  /** Détails de la demande (service) ou précisions (réservation). */
  details?: string;
}

export const MAX_SESSIONS = 20;
export const FREE_SHIPPING_FROM = 100;
export const SHIPPING_RATES = { standard: 5, express: 12 } as const;
export type ShippingMethod = keyof typeof SHIPPING_RATES;

export const lineKey = (offerId: number, slotId?: number) => `${offerId}:${slotId ?? 0}`;

export function lineFromOffer(
  offer: Offer,
  extra: Partial<Omit<CartLine, "key">> = {},
): Omit<CartLine, "key"> {
  const max =
    offer.offer_type === "PHYSICAL_PRODUCT"
      ? Math.max(1, offer.stock ?? 1)
      : offer.offer_type === "SERVICE"
        ? MAX_SESSIONS
        : 1;
  return {
    offerId: offer.id,
    slug: offer.slug,
    title: offer.title,
    type: offer.offer_type,
    price: offer.price ?? 0,
    currency: offer.currency,
    image: offer.image,
    quantity: 1,
    maxQuantity: max,
    ...extra,
  };
}

export const needsShipping = (lines: CartLine[]) => lines.some((l) => l.type === "PHYSICAL_PRODUCT");

export function physicalSubtotal(lines: CartLine[]): number {
  return lines.filter((l) => l.type === "PHYSICAL_PRODUCT").reduce((s, l) => s + l.price * l.quantity, 0);
}

export function shippingCost(lines: CartLine[], method: ShippingMethod): number {
  if (!needsShipping(lines)) return 0;
  if (method === "standard" && physicalSubtotal(lines) >= FREE_SHIPPING_FROM) return 0;
  return SHIPPING_RATES[method];
}

export const cartSubtotal = (lines: CartLine[]) => lines.reduce((s, l) => s + l.price * l.quantity, 0);

export function isCartLine(x: unknown): x is CartLine {
  const l = x as Partial<CartLine> | null;
  return (
    !!l &&
    typeof l.key === "string" &&
    typeof l.offerId === "number" &&
    typeof l.title === "string" &&
    typeof l.price === "number" &&
    typeof l.quantity === "number" &&
    typeof l.maxQuantity === "number"
  );
}
