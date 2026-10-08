import type { BookingStatus, OrderStatus, PaymentStatus, QuoteStatus, Role } from "../types";

export type Tone = "neutral" | "good" | "warn" | "bad" | "info";
interface Label {
  label: string;
  tone: Tone;
}

export const ORDER_STATUS: Record<OrderStatus, Label> = {
  PENDING: { label: "En attente", tone: "warn" },
  CONFIRMED: { label: "Confirmée", tone: "good" },
  IN_PROGRESS: { label: "En cours", tone: "info" },
  SHIPPED: { label: "Expédiée", tone: "info" },
  DELIVERED: { label: "Livrée", tone: "good" },
  COMPLETED: { label: "Terminée", tone: "good" },
  CANCELLED: { label: "Annulée", tone: "bad" },
  REFUNDED: { label: "Remboursée", tone: "neutral" },
};

export const PAYMENT_STATUS: Record<PaymentStatus, Label> = {
  PENDING: { label: "À régler", tone: "warn" },
  PAID: { label: "Réglée", tone: "good" },
  REFUNDED: { label: "Remboursée", tone: "neutral" },
};

export const BOOKING_STATUS: Record<BookingStatus, Label> = {
  PENDING: { label: "À confirmer", tone: "warn" },
  ACCEPTED: { label: "Acceptée", tone: "good" },
  REFUSED: { label: "Refusée", tone: "bad" },
  CANCELLED: { label: "Annulée", tone: "bad" },
  COMPLETED: { label: "Terminée", tone: "neutral" },
};

export const QUOTE_STATUS: Record<QuoteStatus, Label> = {
  NEW: { label: "Nouvelle", tone: "warn" },
  ANSWERED: { label: "Répondue", tone: "good" },
  CLOSED: { label: "Clôturée", tone: "neutral" },
};

export const ROLE_LABEL: Record<Role, string> = {
  USER: "Client",
  PROVIDER: "Prestataire",
  ADMIN: "Administrateur",
};

export const ORDER_STATUSES = Object.keys(ORDER_STATUS) as OrderStatus[];
export const BOOKING_STATUSES = Object.keys(BOOKING_STATUS) as BookingStatus[];
export const QUOTE_STATUSES = Object.keys(QUOTE_STATUS) as QuoteStatus[];
