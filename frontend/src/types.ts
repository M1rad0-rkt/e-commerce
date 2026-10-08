import type { OfferType, PriceMode, PrimaryAction } from "./offers/offerTypes";

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface CategoryBrief {
  id: number;
  name: string;
  slug: string;
}

export interface Category extends CategoryBrief {
  parent_id: number | null;
  applies_to: OfferType[];
  position: number;
  is_active: boolean;
  offer_count: number;
}

export interface OfferAttributes {
  specs?: Record<string, string>;
  included?: string[];
  duration?: string;
  duration_minutes?: number;
  provider_name?: string;
  availability?: string;
  delivery?: string;
  location?: string;
  format?: string;
  file_size?: string;
  license?: string;
  [key: string]: unknown;
}

export interface Offer {
  id: number;
  title: string;
  slug: string;
  description: string;
  offer_type: OfferType;
  price: number | null;
  old_price: number | null;
  price_mode: PriceMode;
  currency: string;
  category: CategoryBrief | null;
  owner: { id: number; full_name: string } | null;
  image: string | null;
  gallery: string[];
  attributes: OfferAttributes;
  rating_avg: number;
  rating_count: number;
  is_active: boolean;
  is_featured: boolean;
  published_at: string | null;
  created_at: string;
  capabilities: {
    has_stock: boolean;
    needs_shipping: boolean;
    needs_slot: boolean;
    primary_action: PrimaryAction;
    quantity_mode: "UNITS" | "SESSIONS" | "NONE";
  };
  primary_action: PrimaryAction;
  in_stock: boolean;
  stock: number | null;
  next_slot_at: string | null;
  physical: { sku: string | null; stock: number; weight_g: number | null; dimensions: Record<string, number> } | null;
}

export interface FacetValue {
  value: string;
  label: string | null;
  count: number;
}

export interface OfferPage extends Paged<Offer> {
  facets: {
    types: FacetValue[];
    categories: FacetValue[];
    price_min: number | null;
    price_max: number | null;
  };
}

export type Role = "USER" | "PROVIDER" | "ADMIN";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface Review {
  id: number;
  offer_id: number;
  offer_title: string | null;
  offer_slug: string | null;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface Slot {
  id: number;
  offer_id: number;
  starts_at: string;
  ends_at: string;
  capacity: number;
  booked_count: number;
  remaining: number;
}

export interface Address {
  id: number;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  postal_code: string;
  country: string;
  is_default: boolean;
}
export type AddressInput = Omit<Address, "id">;

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "SHIPPED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";
export type PaymentStatus = "PENDING" | "PAID" | "REFUNDED";
export type BookingStatus = "PENDING" | "ACCEPTED" | "REFUSED" | "CANCELLED" | "COMPLETED";
export type QuoteStatus = "NEW" | "ANSWERED" | "CLOSED";

export interface OrderItem {
  id: number;
  offer_id: number | null;
  offer_snapshot: { title: string; slug: string; offer_type: OfferType; image: string | null; currency: string };
  quantity: number;
  unit_price: number;
  line_total: number;
  metadata: Record<string, unknown>;
}

export interface Order {
  id: number;
  user_id: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string;
  subtotal: number;
  shipping_cost: number;
  total: number;
  currency: string;
  shipping_method: string | null;
  shipping_address: Omit<Address, "id" | "label" | "is_default"> | null;
  customer_info: { full_name: string; email: string; phone?: string | null };
  notes: string | null;
  created_at: string;
  items: OrderItem[];
  user_email?: string | null;
  user_name?: string | null;
}

export interface Booking {
  id: number;
  user_id: number;
  offer_id: number;
  offer_title: string | null;
  offer_slug: string | null;
  slot_id: number | null;
  status: BookingStatus;
  notes: string | null;
  starts_at: string;
  ends_at: string;
  created_at: string;
  user_name?: string | null;
  user_email?: string | null;
}

export interface Quote {
  id: number;
  offer_id: number;
  offer_title: string | null;
  message: string;
  phone: string | null;
  status: QuoteStatus;
  created_at: string;
  user_name?: string | null;
  user_email?: string | null;
}

export interface AdminStats {
  offers: { total: number; published: number };
  users: number;
  orders: { total: number; pending: number; revenue: number };
  bookings_pending: number;
  quotes_new: number;
}

export interface Message {
  detail: string;
}

export interface AppNotification {
  id: number;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationList {
  items: AppNotification[];
  unread: number;
}
