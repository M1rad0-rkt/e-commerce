import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Icon } from "../components/ui/Icon";
import { EmptyState, Field, FormError, Seo } from "../components/ui/kit";
import { btn, container, inputCls } from "../components/ui/styles";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { api } from "../services/api";
import type { Address, Order } from "../types";
import {
  cartSubtotal,
  needsShipping,
  SHIPPING_RATES,
  shippingCost,
  type CartLine,
  type ShippingMethod,
} from "../utils/cart";
import { errorMessage, money } from "../utils/format";
import { lineSummary } from "./Cart";

type StepId = "contact" | "details" | "shipping" | "payment";
const STEP_LABEL: Record<StepId, string> = {
  contact: "Coordonnées",
  details: "Ta demande",
  shipping: "Livraison",
  payment: "Paiement",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 sm:p-6">
      <h2 className="mb-4 text-2xl">{title}</h2>
      {children}
    </section>
  );
}

function Summary({ lines, method }: { lines: CartLine[]; method: ShippingMethod }) {
  const sub = cartSubtotal(lines);
  const ship = shippingCost(lines, method);
  const currency = lines[0]?.currency ?? "EUR";
  return (
    <aside className="h-fit rounded-2xl bg-white p-5 lg:sticky lg:top-24" aria-label="Récapitulatif de la commande">
      <h2 className="text-2xl">Ta commande</h2>
      <ul className="mt-4 divide-y divide-nuit/10">
        {lines.map((l) => (
          <li key={l.key} className="flex justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="font-semibold leading-snug">
                {l.title}
                {l.quantity > 1 && <span className="text-muted"> × {l.quantity}</span>}
              </p>
              {l.type === "BOOKING" && <p className="text-sm text-muted">{lineSummary(l)}</p>}
            </div>
            <span className="tnum shrink-0 font-semibold">{money(l.price * l.quantity, l.currency)}</span>
          </li>
        ))}
      </ul>
      <dl className="tnum mt-3 space-y-1.5 border-t border-nuit/15 pt-3">
        <div className="flex justify-between">
          <dt>Sous-total</dt>
          <dd>{money(sub, currency)}</dd>
        </div>
        {needsShipping(lines) && (
          <div className="flex justify-between">
            <dt>Livraison</dt>
            <dd>{ship === 0 ? "Offerte" : money(ship, currency)}</dd>
          </div>
        )}
        <div className="flex justify-between pt-1 text-xl font-bold">
          <dt>Total</dt>
          <dd>{money(sub + ship, currency)}</dd>
        </div>
      </dl>
    </aside>
  );
}

export default function CheckoutPage() {
  const { user } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const placed = useRef(false);
  const lines = cart.lines;

  const physical = needsShipping(lines);
  const hasDetails = lines.some((l) => l.type === "SERVICE" || l.type === "BOOKING");
  const hasDigital = lines.some((l) => l.type === "DIGITAL_PRODUCT");
  const steps: StepId[] = ["contact", ...(hasDetails ? (["details"] as const) : []), ...(physical ? (["shipping"] as const) : []), "payment"];

  const [index, setIndex] = useState(0);
  const step = steps[Math.min(index, steps.length - 1)];

  const [contact, setContact] = useState({ full_name: user?.full_name ?? "", email: user?.email ?? "", phone: "" });
  const [address, setAddress] = useState({ line1: "", line2: "", city: "", postal_code: "", country: "Madagascar" });
  const [method, setMethod] = useState<ShippingMethod>("standard");
  const [payment, setPayment] = useState<"demo_card" | "on_delivery">("demo_card");
  const [notes, setNotes] = useState("");

  const { data: saved } = useQuery({ queryKey: ["addresses"], queryFn: () => api<Address[]>("/users/me/addresses") });
  const prefilled = useRef(false);
  useEffect(() => {
    const def = saved?.find((a) => a.is_default) ?? saved?.[0];
    if (def && !prefilled.current) {
      prefilled.current = true;
      setAddress({ line1: def.line1, line2: def.line2 ?? "", city: def.city, postal_code: def.postal_code, country: def.country });
    }
  }, [saved]);

  const order = useMutation({
    mutationFn: () =>
      api<Order>("/orders", {
        method: "POST",
        body: {
          items: lines.map((l) => ({
            offer_id: l.offerId,
            quantity: l.quantity,
            slot_id: l.slotId ?? null,
            metadata: l.type === "SERVICE" ? { details: l.details ?? "" } : l.type === "BOOKING" ? { notes: l.details ?? "" } : {},
          })),
          customer_info: { ...contact, phone: contact.phone.trim() || null },
          shipping_address: physical ? { ...address, line2: address.line2.trim() || null } : null,
          shipping_method: physical ? method : null,
          payment_method: hasDigital ? "demo_card" : payment,
          notes: notes.trim() || null,
        },
      }),
    onSuccess: (o) => {
      placed.current = true;
      cart.clear();
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["offer"] });
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      queryClient.invalidateQueries({ queryKey: ["slots"] });
      navigate(`/commande/confirmation/${o.id}`, { replace: true });
    },
  });

  if (lines.length === 0 && !placed.current)
    return (
      <EmptyState title="Ton panier est vide" action={{ to: "/explorer", label: "Explorer les offres" }}>
        Ajoute une offre avant de passer commande.
      </EmptyState>
    );

  function next(e: FormEvent) {
    e.preventDefault();
    if (index < steps.length - 1) {
      setIndex(index + 1);
      window.scrollTo({ top: 0 });
    } else {
      order.mutate();
    }
  }

  const last = index >= steps.length - 1;
  const stepForm = (children: ReactNode) => (
    <form onSubmit={next} className="space-y-5">
      {children}
      <FormError message={order.error ? errorMessage(order.error) : null} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        {index > 0 ? (
          <button type="button" className={btn("ghost")} onClick={() => setIndex(index - 1)}>
            <Icon name="left" size={18} /> Retour
          </button>
        ) : (
          <Link to="/panier" className={btn("ghost")}>
            <Icon name="left" size={18} /> Panier
          </Link>
        )}
        <button type="submit" disabled={order.isPending} className={btn("primary", "lg")}>
          {last ? (order.isPending ? "Validation…" : "Confirmer la commande") : "Continuer"}
        </button>
      </div>
    </form>
  );

  return (
    <div className={`${container} py-8 sm:py-12`}>
      <Seo title="Commande" />
      <h1 className="text-4xl sm:text-5xl">Commande</h1>

      <ol className="mt-6 flex flex-wrap gap-x-5 gap-y-2" aria-label="Étapes de la commande">
        {steps.map((s, i) => (
          <li key={s} aria-current={s === step ? "step" : undefined} className={`flex items-center gap-2 font-semibold ${i <= index ? "text-nuit" : "text-muted"}`}>
            <span className={`tnum grid h-7 w-7 place-items-center rounded-full text-sm ${i < index ? "bg-feuille text-white" : i === index ? "bg-nuit text-white" : "bg-nuit/10"}`}>
              {i < index ? <Icon name="check" size={16} /> : i + 1}
            </span>
            {STEP_LABEL[s]}
          </li>
        ))}
      </ol>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div>
          {step === "contact" && (
            <Section title="Tes coordonnées">
              {stepForm(
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nom complet" className="sm:col-span-2">
                    <input required minLength={2} autoComplete="name" className={inputCls} value={contact.full_name} onChange={(e) => setContact({ ...contact, full_name: e.target.value })} />
                  </Field>
                  <Field label="Adresse e-mail">
                    <input required type="email" autoComplete="email" className={inputCls} value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
                  </Field>
                  <Field label="Téléphone" hint="Utile pour la livraison ou une séance.">
                    <input type="tel" autoComplete="tel" className={inputCls} value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
                  </Field>
                </div>,
              )}
            </Section>
          )}

          {step === "details" && (
            <Section title="Ta demande">
              {stepForm(
                <div className="space-y-5">
                  {lines
                    .filter((l) => l.type === "SERVICE" || l.type === "BOOKING")
                    .map((l) => (
                      <label key={l.key} className="block">
                        <span className="block font-semibold">{l.title}</span>
                        {l.type === "BOOKING" && <span className="mb-1 block text-sm text-muted">{lineSummary(l)}</span>}
                        <textarea
                          required={l.type === "SERVICE"}
                          rows={3}
                          maxLength={1000}
                          className={`${inputCls} mt-1`}
                          value={l.details ?? ""}
                          onChange={(e) => cart.setDetails(l.key, e.target.value)}
                          placeholder={l.type === "SERVICE" ? "Décris ce que tu attends : contexte, contraintes, dates." : "Une précision pour la séance ? (facultatif)"}
                        />
                      </label>
                    ))}
                </div>,
              )}
            </Section>
          )}

          {step === "shipping" && (
            <Section title="Livraison">
              {stepForm(
                <div className="space-y-5">
                  {saved && saved.length > 0 && (
                    <label className="block">
                      <span className="mb-1 block text-sm font-semibold">Adresse enregistrée</span>
                      <select
                        className={inputCls}
                        defaultValue=""
                        onChange={(e) => {
                          const a = saved.find((x) => x.id === Number(e.target.value));
                          if (a) setAddress({ line1: a.line1, line2: a.line2 ?? "", city: a.city, postal_code: a.postal_code, country: a.country });
                        }}
                      >
                        <option value="">Choisir…</option>
                        {saved.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label} : {a.line1}, {a.city}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Adresse" className="sm:col-span-2">
                      <input required minLength={3} autoComplete="address-line1" className={inputCls} value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} />
                    </Field>
                    <Field label="Complément (facultatif)" className="sm:col-span-2">
                      <input autoComplete="address-line2" className={inputCls} value={address.line2} onChange={(e) => setAddress({ ...address, line2: e.target.value })} />
                    </Field>
                    <Field label="Code postal">
                      <input required autoComplete="postal-code" className={inputCls} value={address.postal_code} onChange={(e) => setAddress({ ...address, postal_code: e.target.value })} />
                    </Field>
                    <Field label="Ville">
                      <input required autoComplete="address-level2" className={inputCls} value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
                    </Field>
                    <Field label="Pays" className="sm:col-span-2">
                      <input required minLength={2} autoComplete="country-name" className={inputCls} value={address.country} onChange={(e) => setAddress({ ...address, country: e.target.value })} />
                    </Field>
                  </div>
                  <fieldset>
                    <legend className="mb-2 font-semibold">Mode de livraison</legend>
                    <div className="space-y-2">
                      {(
                        [
                          ["standard", "Standard", "3 à 5 jours ouvrés"],
                          ["express", "Express", "1 à 2 jours ouvrés"],
                        ] as const
                      ).map(([value, label, delay]) => (
                        <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3.5 ${method === value ? "border-nuit bg-brume" : "border-nuit/15"}`}>
                          <input type="radio" name="ship" className="h-5 w-5 accent-cobalt" checked={method === value} onChange={() => setMethod(value)} />
                          <span className="flex-1">
                            <span className="block font-semibold">{label}</span>
                            <span className="text-sm text-muted">{delay}</span>
                          </span>
                          <span className="tnum font-semibold">
                            {shippingCost(lines, value) === 0 ? "Offerte" : money(SHIPPING_RATES[value])}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>,
              )}
            </Section>
          )}

          {step === "payment" && (
            <Section title="Paiement">
              {stepForm(
                <div className="space-y-5">
                  <p className="rounded-xl bg-safran/25 px-4 py-3 text-safran-deep" role="note">
                    Paiement de démonstration : aucune carte n'est demandée et rien n'est débité.
                  </p>
                  <fieldset>
                    <legend className="mb-2 font-semibold">Moyen de paiement</legend>
                    <div className="space-y-2">
                      <label className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3.5 ${payment === "demo_card" || hasDigital ? "border-nuit bg-brume" : "border-nuit/15"}`}>
                        <input type="radio" name="pay" className="h-5 w-5 accent-cobalt" checked={payment === "demo_card" || hasDigital} onChange={() => setPayment("demo_card")} />
                        <span className="font-semibold">Payer en ligne</span>
                      </label>
                      {!hasDigital && (
                        <label className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3.5 ${payment === "on_delivery" ? "border-nuit bg-brume" : "border-nuit/15"}`}>
                          <input type="radio" name="pay" className="h-5 w-5 accent-cobalt" checked={payment === "on_delivery"} onChange={() => setPayment("on_delivery")} />
                          <span className="font-semibold">Payer à la livraison ou sur place</span>
                        </label>
                      )}
                    </div>
                    {hasDigital && <p className="mt-2 text-sm text-muted">Un produit numérique se règle en ligne.</p>}
                  </fieldset>
                  <Field label="Un mot pour nous ? (facultatif)">
                    <textarea rows={2} maxLength={2000} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </Field>
                </div>,
              )}
            </Section>
          )}
        </div>
        <Summary lines={lines} method={method} />
      </div>
    </div>
  );
}
