import { Link, useNavigate } from "react-router-dom";

import { OfferArt } from "../components/offers/OfferArt";
import { Icon } from "../components/ui/Icon";
import { EmptyState, QuantityStepper, Seo, TypeBadge } from "../components/ui/kit";
import { btn, container } from "../components/ui/styles";
import { useCart } from "../context/CartContext";
import { OFFER_TYPES } from "../offers/offerTypes";
import { FREE_SHIPPING_FROM, needsShipping, physicalSubtotal, SHIPPING_RATES, type CartLine } from "../utils/cart";
import { fmtDayLong, fmtTime, money } from "../utils/format";

export function lineSummary(l: CartLine): string | null {
  if (l.type === "BOOKING" && l.slotStart) return `Le ${fmtDayLong(l.slotStart)} à ${fmtTime(l.slotStart)}`;
  if (l.type === "SERVICE") return l.details ? `Demande : ${l.details}` : null;
  return null;
}

function CartRow({ line }: { line: CartLine }) {
  const cart = useCart();
  const meta = OFFER_TYPES[line.type];
  const summary = lineSummary(line);

  return (
    <li className="flex gap-4 rounded-2xl bg-white p-4">
      <Link to={`/offers/${line.slug}`} className="block h-24 w-24 shrink-0 overflow-hidden rounded-xl sm:h-28 sm:w-28" tabIndex={-1} aria-hidden="true">
        <OfferArt offer={{ id: line.offerId, offer_type: line.type, title: line.title, image: line.image }} decorative />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <TypeBadge type={line.type} />
            <h2 className="mt-1.5 text-xl font-bold leading-tight">
              <Link to={`/offers/${line.slug}`} className="hover:underline">
                {line.title}
              </Link>
            </h2>
          </div>
          <button
            type="button"
            onClick={() => cart.remove(line.key)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted hover:bg-corail/10 hover:text-corail"
            aria-label={`Retirer « ${line.title} » du panier`}
          >
            <Icon name="trash" size={20} />
          </button>
        </div>
        {summary && <p className="line-clamp-2 text-muted">{summary}</p>}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
          {line.type === "PHYSICAL_PRODUCT" || line.type === "SERVICE" ? (
            <div className="flex items-center gap-2">
              <QuantityStepper
                value={line.quantity}
                max={line.maxQuantity}
                onChange={(q) => cart.setQuantity(line.key, q)}
                label={line.type === "SERVICE" ? "Nombre de prestations" : "Quantité"}
              />
              {line.type === "SERVICE" && <span className="text-sm text-muted">prestation{line.quantity > 1 ? "s" : ""}</span>}
            </div>
          ) : (
            <p className="text-muted">{line.type === "BOOKING" ? "1 créneau" : "1 fichier"}</p>
          )}
          <p className="tnum text-right">
            <span className="block text-lg font-bold">{money(line.price * line.quantity, line.currency)}</span>
            {line.quantity > 1 && <span className="text-sm text-muted">{money(line.price, line.currency)} l'unité</span>}
          </p>
        </div>
        <span className="sr-only">{meta.label}</span>
      </div>
    </li>
  );
}

export function FreeShippingHint({ lines }: { lines: CartLine[] }) {
  if (!needsShipping(lines)) return null;
  const sub = physicalSubtotal(lines);
  const missing = FREE_SHIPPING_FROM - sub;
  return (
    <p className="flex items-start gap-2 rounded-xl bg-cobalt/10 px-3.5 py-2.5 text-sm text-cobalt">
      <Icon name="truck" size={18} className="mt-0.5 shrink-0" />
      {missing > 0
        ? `Plus que ${money(missing)} d'objets pour la livraison standard offerte.`
        : "Livraison standard offerte pour tes objets."}
    </p>
  );
}

export default function CartPage() {
  const { lines, subtotal, count, clear } = useCart();
  const navigate = useNavigate();

  if (lines.length === 0)
    return (
      <div className={container}>
        <Seo title="Panier" />
        <EmptyState title="Ton panier est vide" action={{ to: "/explorer", label: "Explorer les offres" }}>
          Ajoute un objet, un service ou une séance : tout se règle en une seule commande.
        </EmptyState>
      </div>
    );

  const shipping = needsShipping(lines);
  const standard = physicalSubtotal(lines) >= FREE_SHIPPING_FROM ? 0 : SHIPPING_RATES.standard;
  const currency = lines[0].currency;

  return (
    <div className={`${container} py-8 sm:py-12`}>
      <Seo title="Panier" />
      <h1 className="text-4xl sm:text-5xl">Panier</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div>
          <ul className="space-y-4">
            {lines.map((l) => (
              <CartRow key={l.key} line={l} />
            ))}
          </ul>
          <button type="button" onClick={clear} className="mt-4 text-sm font-semibold text-muted underline underline-offset-4 hover:text-corail">
            Vider le panier
          </button>
        </div>

        <aside className="h-fit space-y-4 rounded-2xl bg-white p-5 lg:sticky lg:top-24" aria-label="Récapitulatif">
          <h2 className="text-2xl">Récapitulatif</h2>
          <dl className="tnum space-y-2">
            <div className="flex justify-between">
              <dt>
                Sous-total ({count} article{count > 1 ? "s" : ""})
              </dt>
              <dd className="font-semibold">{money(subtotal, currency)}</dd>
            </div>
            {shipping && (
              <div className="flex justify-between">
                <dt>Livraison standard</dt>
                <dd className="font-semibold">{standard === 0 ? "Offerte" : money(standard, currency)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-nuit/15 pt-3 text-xl font-bold">
              <dt>Total</dt>
              <dd>{money(subtotal + (shipping ? standard : 0), currency)}</dd>
            </div>
          </dl>
          {shipping && <p className="text-sm text-muted">Le mode de livraison (standard ou express) se choisit à l'étape suivante.</p>}
          <FreeShippingHint lines={lines} />
          <button type="button" className={btn("primary", "lg", "w-full")} onClick={() => navigate("/commande")}>
            Passer commande
          </button>
          <Link to="/explorer" className="block text-center font-semibold underline underline-offset-4">
            Continuer mes achats
          </Link>
        </aside>
      </div>
    </div>
  );
}
