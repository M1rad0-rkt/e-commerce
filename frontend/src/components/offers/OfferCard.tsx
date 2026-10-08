import { Link, useNavigate } from "react-router-dom";

import { useCart } from "../../context/CartContext";
import { useToast } from "../../context/ToastContext";
import { ACTION_LABEL } from "../../offers/offerTypes";
import type { Offer } from "../../types";
import { lineFromOffer } from "../../utils/cart";
import { discountPercent, money, priceText } from "../../utils/format";
import { Stars, TypeBadge } from "../ui/kit";
import { btn } from "../ui/styles";
import { FavoriteButton } from "./FavoriteButton";
import { OfferArt } from "./OfferArt";

/**
 * Carte universelle : s'adapte au type (produit, service, réservation, numérique) et au mode de prix.
 * L'action du pied de carte vient de `primary_action`, calculée par le backend.
 */
export function OfferCard({ offer, className = "" }: { offer: Offer; className?: string }) {
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();

  const action = offer.primary_action;
  const direct = action === "ADD_TO_CART" || action === "BUY_NOW";
  const unavailable = !offer.in_stock;
  const discount = discountPercent(offer);
  const href = `/offers/${offer.slug}`;

  function addDirect() {
    const result = cart.add(lineFromOffer(offer));
    if (action === "BUY_NOW") {
      navigate("/panier");
    } else if (result === "limit") {
      toast.push("Tu as déjà pris tout le stock disponible.", "error");
    } else {
      toast.push(`« ${offer.title} » est dans ton panier.`);
    }
  }

  const unavailableLabel = offer.offer_type === "BOOKING" ? "Aucun créneau" : "Rupture de stock";

  return (
    <article className={`ticket-wrap h-full ${className}`}>
      <div className="ticket flex h-full flex-col">
        <div className="relative aspect-[4/3] overflow-hidden rounded-t-[10px]">
          <OfferArt offer={offer} decorative />
          <div className="absolute left-3 top-3">
            <TypeBadge type={offer.offer_type} solid />
          </div>
          <FavoriteButton offerId={offer.id} title={offer.title} className="absolute right-3 top-3 z-10" />
          {discount !== null && (
            <span className="tnum absolute bottom-3 left-3 rounded-full bg-safran px-2.5 py-1 text-sm font-bold text-nuit">
              −{discount} %
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1.5 px-4 pb-4 pt-3.5">
          {offer.category && <p className="text-sm text-muted">{offer.category.name}</p>}
          <h3 className="text-xl font-bold leading-tight">
            <Link to={href} className="after:absolute after:inset-0 after:content-['']">
              {offer.title}
            </Link>
          </h3>
          <Stars rating={offer.rating_avg} count={offer.rating_count} className="mt-auto pt-1" />
        </div>

        <div className="ticket-foot flex items-center justify-between gap-3 px-4">
          <p className="price leading-tight">
            {offer.old_price !== null && discount !== null && (
              <span className="tnum block text-sm text-muted line-through">{money(offer.old_price, offer.currency)}</span>
            )}
            <span className="tnum text-lg font-bold">{priceText(offer)}</span>
          </p>
          {unavailable ? (
            <span className="relative z-10 rounded-full bg-nuit/10 px-3.5 py-1.5 text-sm font-semibold text-muted">
              {unavailableLabel}
            </span>
          ) : direct ? (
            <button type="button" onClick={addDirect} className={btn("primary", "sm", "relative z-10")}>
              {ACTION_LABEL[action]}
            </button>
          ) : (
            <Link to={href} className={btn("primary", "sm", "relative z-10")} tabIndex={-1} aria-hidden="true">
              {ACTION_LABEL[action]}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export function OfferCardSkeleton() {
  return (
    <div className="ticket-wrap" aria-hidden="true">
      <div className="ticket">
        <div className="skeleton aspect-[4/3] rounded-t-[10px]" />
        <div className="space-y-2 px-4 py-4">
          <div className="skeleton h-3.5 w-1/3 rounded" />
          <div className="skeleton h-6 w-4/5 rounded" />
          <div className="skeleton h-3.5 w-1/4 rounded" />
        </div>
        <div className="ticket-foot flex items-center justify-between px-4">
          <div className="skeleton h-6 w-16 rounded" />
          <div className="skeleton h-8 w-28 rounded-full" />
        </div>
      </div>
    </div>
  );
}
