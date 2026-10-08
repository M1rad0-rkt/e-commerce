// Miroir frontend de backend/app/services/offer_types.py.
// Ajouter un type d'offre = une entrée ici + une entrée côté backend + un composant de détail.

import type { IconName } from "../components/ui/Icon";

export type OfferType = "PHYSICAL_PRODUCT" | "SERVICE" | "DIGITAL_PRODUCT" | "BOOKING";
export type PriceMode = "FIXED" | "STARTING_AT" | "QUOTE";
export type PrimaryAction = "ADD_TO_CART" | "BUY_NOW" | "ORDER_SERVICE" | "BOOK" | "REQUEST_QUOTE";

export interface OfferTypeMeta {
  label: string;
  plural: string;
  description: string;
  icon: IconName;
  /** Fond plein + texte lisible dessus. */
  solid: string;
  /** Fond léger + texte coloré lisible dessus. */
  soft: string;
  /** Texte coloré sur fond clair. */
  text: string;
  /** Couleurs pour les illustrations SVG. */
  art: { bg: string; solid: string; mid: string };
}

export const OFFER_TYPES: Record<OfferType, OfferTypeMeta> = {
  PHYSICAL_PRODUCT: {
    label: "Produit",
    plural: "Produits",
    description: "Des objets livrés chez vous.",
    icon: "box",
    solid: "bg-cobalt text-white",
    soft: "bg-cobalt/10 text-cobalt",
    text: "text-cobalt",
    art: { bg: "#DDE3FF", solid: "#2B4BFF", mid: "#9AA9FF" },
  },
  SERVICE: {
    label: "Service",
    plural: "Services",
    description: "Un travail réalisé pour vous, à distance.",
    icon: "pencil",
    solid: "bg-feuille text-white",
    soft: "bg-feuille/10 text-feuille",
    text: "text-feuille",
    art: { bg: "#D3EFE3", solid: "#0B7A55", mid: "#7FD1AF" },
  },
  BOOKING: {
    label: "Réservation",
    plural: "Réservations",
    description: "Un créneau à réserver : séance, cours, conseil.",
    icon: "calendar",
    solid: "bg-safran text-nuit",
    soft: "bg-safran/25 text-safran-deep",
    text: "text-safran-deep",
    art: { bg: "#FFEBB8", solid: "#FFB400", mid: "#FFD36B" },
  },
  DIGITAL_PRODUCT: {
    label: "Numérique",
    plural: "Numérique",
    description: "Des fichiers à télécharger tout de suite.",
    icon: "file",
    solid: "bg-prune text-white",
    soft: "bg-prune/10 text-prune",
    text: "text-prune",
    art: { bg: "#F0DAF9", solid: "#9B2FC9", mid: "#CF93EA" },
  },
};

/** Ordre d'affichage dans les listes et menus. */
export const TYPE_ORDER: OfferType[] = ["PHYSICAL_PRODUCT", "SERVICE", "BOOKING", "DIGITAL_PRODUCT"];

export const ACTION_LABEL: Record<PrimaryAction, string> = {
  ADD_TO_CART: "Ajouter au panier",
  BUY_NOW: "Acheter",
  ORDER_SERVICE: "Voir le service",
  BOOK: "Réserver",
  REQUEST_QUOTE: "Demander un devis",
};

export const typeFromParam = (v: string | null): OfferType | null =>
  v && v in OFFER_TYPES ? (v as OfferType) : null;
