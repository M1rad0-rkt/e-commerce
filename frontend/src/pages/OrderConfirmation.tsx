import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { Icon } from "../components/ui/Icon";
import { ErrorState, Seo, Spinner, StatusBadge } from "../components/ui/kit";
import { btn, container } from "../components/ui/styles";
import { api } from "../services/api";
import type { Order } from "../types";
import { fmtDate, fmtDayLong, fmtTime, money } from "../utils/format";
import { ORDER_STATUS, PAYMENT_STATUS } from "../utils/labels";

export function orderNextSteps(o: Order): string[] {
  const types = new Set(o.items.map((i) => i.offer_snapshot.offer_type));
  const steps: string[] = [];
  if (types.has("PHYSICAL_PRODUCT")) steps.push(`Tes objets seront livrés à ${o.shipping_address?.city ?? "ton adresse"}. Tu suis l'état de la commande depuis ton compte.`);
  if (types.has("SERVICE")) steps.push("L'offreur lit ta demande et revient vers toi par e-mail pour démarrer.");
  if (types.has("BOOKING")) steps.push("Ton créneau est bloqué. L'offreur doit encore le confirmer : tu verras son statut dans Mes réservations.");
  if (types.has("DIGITAL_PRODUCT")) steps.push("Ton achat numérique est enregistré dans Mes commandes.");
  return steps;
}

export default function OrderConfirmationPage() {
  const { id } = useParams();
  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: ["orders", id],
    queryFn: () => api<Order>(`/orders/${id}`),
  });

  if (isLoading) return <Spinner />;
  if (error || !order) return <ErrorState error={error} onRetry={() => refetch()} />;

  const status = ORDER_STATUS[order.status];
  const payment = PAYMENT_STATUS[order.payment_status];

  return (
    <div className={`${container} max-w-3xl py-10 sm:py-14`}>
      <Seo title={`Commande n°${order.id}`} />
      <div className="flex items-center gap-3 text-feuille">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-feuille text-white">
          <Icon name="check" size={26} />
        </span>
        <p className="text-xl font-bold">Commande enregistrée</p>
      </div>
      <h1 className="mt-4 text-4xl sm:text-5xl">Merci, ta commande n°{order.id} est bien reçue.</h1>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-muted">
        Passée le {fmtDate(order.created_at)}
        <StatusBadge {...status} />
        <StatusBadge {...payment} />
      </p>

      <section className="mt-8 rounded-2xl bg-white p-5 sm:p-6" aria-labelledby="next-title">
        <h2 id="next-title" className="text-2xl">
          Et maintenant ?
        </h2>
        <ul className="mt-3 space-y-2">
          {orderNextSteps(order).map((s) => (
            <li key={s} className="flex gap-2.5">
              <Icon name="right" size={20} className="mt-0.5 shrink-0 text-cobalt" />
              {s}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl bg-white p-5 sm:p-6" aria-labelledby="detail-title">
        <h2 id="detail-title" className="text-2xl">
          Détail
        </h2>
        <ul className="mt-3 divide-y divide-nuit/10">
          {order.items.map((i) => {
            const start = typeof i.metadata.starts_at === "string" ? i.metadata.starts_at : null;
            return (
              <li key={i.id} className="flex justify-between gap-4 py-3">
                <div>
                  <p className="font-semibold">
                    {i.offer_snapshot.title}
                    {i.quantity > 1 && <span className="text-muted"> × {i.quantity}</span>}
                  </p>
                  {start && <p className="text-sm text-muted">Le {fmtDayLong(start)} à {fmtTime(start)}</p>}
                </div>
                <span className="tnum font-semibold">{money(i.line_total, order.currency)}</span>
              </li>
            );
          })}
        </ul>
        <dl className="tnum mt-3 space-y-1.5 border-t border-nuit/15 pt-3">
          <div className="flex justify-between">
            <dt>Sous-total</dt>
            <dd>{money(order.subtotal, order.currency)}</dd>
          </div>
          {order.shipping_address && (
            <div className="flex justify-between">
              <dt>Livraison</dt>
              <dd>{order.shipping_cost === 0 ? "Offerte" : money(order.shipping_cost, order.currency)}</dd>
            </div>
          )}
          <div className="flex justify-between pt-1 text-xl font-bold">
            <dt>Total</dt>
            <dd>{money(order.total, order.currency)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-muted">Paiement de démonstration : aucun montant n'a été débité.</p>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/compte/commandes" className={btn("primary", "lg")}>
          Voir mes commandes
        </Link>
        <Link to="/explorer" className={btn("secondary", "lg")}>
          Continuer mes achats
        </Link>
      </div>
    </div>
  );
}
