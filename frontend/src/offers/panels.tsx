import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type ComponentType, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Icon, type IconName } from "../components/ui/Icon";
import { FormError, QuantityStepper } from "../components/ui/kit";
import { btn, inputCls } from "../components/ui/styles";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { api } from "../services/api";
import type { Offer, Slot } from "../types";
import { FREE_SHIPPING_FROM, lineFromOffer, MAX_SESSIONS } from "../utils/cart";
import { dayKey, errorMessage, fmtDayLong, fmtTime, money, plural, toDate } from "../utils/format";

export interface PanelProps {
  offer: Offer;
}

/* ---------- Éléments communs ---------- */

function Facts({ items }: { items: [IconName, string, string | undefined][] }) {
  const rows = items.filter((r): r is [IconName, string, string] => !!r[2]);
  if (!rows.length) return null;
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map(([icon, label, value]) => (
        <div key={label} className="flex items-start gap-3">
          <Icon name={icon} size={22} className="mt-0.5 shrink-0 text-muted" />
          <div>
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

function Included({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h3 className="mb-2 text-lg font-bold">Ce qui est inclus</h3>
      <ul className="space-y-1.5">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-2.5">
            <Icon name="check" size={20} className="mt-0.5 shrink-0 text-feuille" />
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="space-y-6">{children}</div>;
}

function useAddToCart(offer: Offer) {
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  return (extra: Parameters<typeof lineFromOffer>[1], goToCart: boolean) => {
    const result = cart.add(lineFromOffer(offer, extra));
    if (result === "limit") {
      toast.push("Tu as déjà pris tout le stock disponible.", "error");
    } else if (result === "exists") {
      toast.push("Cette offre est déjà dans ton panier.");
      if (goToCart) navigate("/panier");
    } else if (goToCart) {
      navigate("/panier");
    } else {
      toast.push(`« ${offer.title} » est dans ton panier.`);
    }
  };
}

/* ---------- Produit physique ---------- */

export function PhysicalPanel({ offer }: PanelProps) {
  const add = useAddToCart(offer);
  const stock = offer.stock ?? 0;
  const [qty, setQty] = useState(1);
  const specs = Object.entries(offer.attributes.specs ?? {});

  return (
    <Panel>
      <p className={`font-semibold ${stock > 0 ? (stock <= 5 ? "text-safran-deep" : "text-feuille") : "text-corail"}`}>
        {stock === 0 ? "Rupture de stock" : stock <= 5 ? `Plus que ${plural(stock, "exemplaire", "exemplaires")}` : "En stock"}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <QuantityStepper value={qty} max={Math.max(1, stock)} onChange={setQty} label="Quantité" />
        <button type="button" disabled={stock === 0} className={btn("primary", "lg", "flex-1 sm:flex-none")} onClick={() => add({ quantity: qty }, false)}>
          <Icon name="bag" size={20} /> Ajouter au panier
        </button>
      </div>
      <Facts
        items={[
          ["truck", "Livraison", offer.attributes.delivery],
          ["box", "Frais de port", `5 € en standard, offerts dès ${money(FREE_SHIPPING_FROM, offer.currency)} d'objets. Express : 12 €.`],
        ]}
      />
      {specs.length > 0 && (
        <div>
          <h3 className="mb-2 text-lg font-bold">Caractéristiques</h3>
          <dl className="divide-y divide-nuit/10 rounded-xl bg-white">
            {specs.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Panel>
  );
}

/* ---------- Service ---------- */

export function ServicePanel({ offer }: PanelProps) {
  const add = useAddToCart(offer);
  const [sessions, setSessions] = useState(1);
  const [details, setDetails] = useState("");
  const a = offer.attributes;

  return (
    <Panel>
      <Facts
        items={[
          ["clock", "Durée estimée", a.duration],
          ["user", "Prestataire", a.provider_name ?? offer.owner?.full_name],
          ["calendar", "Disponibilité", a.availability],
        ]}
      />
      <Included items={a.included} />
      <div className="space-y-4 rounded-2xl bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-semibold">Nombre de prestations</span>
          <QuantityStepper value={sessions} max={MAX_SESSIONS} onChange={setSessions} label="Nombre de prestations" />
        </div>
        <label className="block">
          <span className="mb-1 block font-semibold">Détails de ta demande</span>
          <textarea
            rows={3}
            maxLength={1000}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Décris ton projet, tes contraintes, tes dates."
            className={inputCls}
          />
        </label>
        <button type="button" className={btn("primary", "lg", "w-full")} onClick={() => add({ quantity: sessions, details: details.trim() || undefined }, true)}>
          Commander ce service
        </button>
        <p className="text-sm text-muted">Tu pourras préciser ta demande avant de payer.</p>
      </div>
    </Panel>
  );
}

/* ---------- Réservation ---------- */

export function BookingPanel({ offer }: PanelProps) {
  const add = useAddToCart(offer);
  const { data: slots, isLoading, error } = useQuery({
    queryKey: ["slots", offer.id],
    queryFn: () => api<Slot[]>(`/offers/${offer.id}/slots`, { auth: false }),
  });
  const [day, setDay] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const a = offer.attributes;

  const days = new Map<string, Slot[]>();
  for (const s of slots ?? []) {
    const k = dayKey(s.starts_at);
    days.set(k, [...(days.get(k) ?? []), s]);
  }
  const dayKeys = [...days.keys()].filter((k) => days.get(k)!.some((s) => s.remaining > 0));
  const activeDay = day && dayKeys.includes(day) ? day : dayKeys[0];
  const daySlots = activeDay ? days.get(activeDay) ?? [] : [];
  const chosen = slots?.find((s) => s.id === slotId && s.remaining > 0);

  return (
    <Panel>
      <Facts
        items={[
          ["clock", "Durée", a.duration_minutes ? `${a.duration_minutes} minutes` : a.duration],
          ["pin", "Lieu", a.location],
          ["user", "Avec", a.provider_name ?? offer.owner?.full_name],
        ]}
      />
      <Included items={a.included} />

      <div className="rounded-2xl bg-white p-5">
        <h3 className="text-lg font-bold">Choisis un créneau</h3>
        {isLoading ? (
          <div className="skeleton mt-4 h-24 rounded-lg" />
        ) : error ? (
          <FormError message={errorMessage(error)} />
        ) : dayKeys.length === 0 ? (
          <p className="mt-3 text-muted">Aucun créneau disponible pour le moment. Reviens bientôt.</p>
        ) : (
          <>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Jours disponibles">
              {dayKeys.map((k) => {
                const first = days.get(k)![0];
                const d = toDate(first.starts_at);
                const on = k === activeDay;
                return (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => {
                      setDay(k);
                      setSlotId(null);
                    }}
                    className={`flex w-16 shrink-0 flex-col items-center rounded-xl border-2 py-2 ${on ? "border-nuit bg-nuit text-white" : "border-nuit/20 hover:border-nuit"}`}
                  >
                    <span className="text-sm">{d.toLocaleDateString("fr-FR", { weekday: "short" })}</span>
                    <span className="tnum text-2xl font-bold leading-none">{d.getDate()}</span>
                    <span className="text-sm">{d.toLocaleDateString("fr-FR", { month: "short" })}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 font-semibold capitalize">{daySlots[0] && fmtDayLong(daySlots[0].starts_at)}</p>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Horaires">
              {daySlots.map((s) => {
                const full = s.remaining === 0;
                const on = s.id === slotId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={full}
                    onClick={() => setSlotId(s.id)}
                    className={`rounded-full border-2 px-4 py-2 font-semibold ${
                      on ? "border-safran bg-safran text-nuit" : "border-nuit/25 hover:border-nuit"
                    } disabled:cursor-not-allowed disabled:border-nuit/10 disabled:text-muted disabled:line-through`}
                  >
                    <span className="tnum">{fmtTime(s.starts_at)}</span>
                    {s.capacity > 1 && !full && <span className="ml-1.5 text-sm font-normal">· {plural(s.remaining, "place", "places")}</span>}
                    {full && <span className="ml-1.5 text-sm font-normal no-underline">· complet</span>}
                  </button>
                );
              })}
            </div>
            <label className="mt-5 block">
              <span className="mb-1 block font-semibold">Précisions (facultatif)</span>
              <textarea rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="Une demande particulière ?" />
            </label>
            <button
              type="button"
              disabled={!chosen}
              className={btn("primary", "lg", "mt-4 w-full")}
              onClick={() =>
                chosen &&
                add({ slotId: chosen.id, slotStart: chosen.starts_at, slotEnd: chosen.ends_at, details: notes.trim() || undefined }, true)
              }
            >
              {chosen ? `Réserver le ${fmtDayLong(chosen.starts_at)} à ${fmtTime(chosen.starts_at)}` : "Choisis un horaire"}
            </button>
            <p className="mt-2 text-sm text-muted">Le créneau est bloqué à la commande. Il est ensuite confirmé par l'offreur.</p>
          </>
        )}
      </div>
    </Panel>
  );
}

/* ---------- Produit numérique ---------- */

export function DigitalPanel({ offer }: PanelProps) {
  const add = useAddToCart(offer);
  const a = offer.attributes;
  return (
    <Panel>
      <Facts
        items={[
          ["file", "Format", a.format],
          ["download", "Taille", a.file_size],
          ["shield", "Licence", a.license],
        ]}
      />
      <Included items={a.included} />
      <div className="rounded-2xl bg-white p-5">
        <button type="button" className={btn("primary", "lg", "w-full")} onClick={() => add({}, true)}>
          <Icon name="download" size={20} /> Acheter et télécharger
        </button>
        <p className="mt-2 text-sm text-muted">Le fichier est disponible dès que la commande est réglée.</p>
      </div>
    </Panel>
  );
}

/* ---------- Sur devis ---------- */

export function QuotePanel({ offer }: PanelProps) {
  const { user } = useAuth();
  const location = useLocation();
  const toast = useToast();
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const a = offer.attributes;

  const send = useMutation({
    mutationFn: () =>
      api("/quote-requests", { method: "POST", body: { offer_id: offer.id, message: message.trim(), phone: phone.trim() || null } }),
    onSuccess: () => {
      setSent(true);
      toast.push("Ta demande de devis est envoyée.");
    },
  });

  return (
    <Panel>
      <Facts
        items={[
          ["clock", "Durée estimée", a.duration],
          ["user", "Prestataire", a.provider_name ?? offer.owner?.full_name],
          ["calendar", "Réponse", a.availability],
        ]}
      />
      <Included items={a.included} />
      <div className="rounded-2xl bg-white p-5">
        <h3 className="text-lg font-bold">Demander un devis</h3>
        {sent ? (
          <p className="mt-3 text-feuille" role="status">
            Demande envoyée. Tu peux suivre sa réponse dans{" "}
            <Link to="/compte/devis" className="font-semibold underline">
              ton espace
            </Link>
            .
          </p>
        ) : !user ? (
          <p className="mt-3">
            <Link to={`/connexion?next=${encodeURIComponent(location.pathname)}`} className={btn("primary")}>
              Connecte-toi pour demander un devis
            </Link>
          </p>
        ) : (
          <form
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              send.mutate();
            }}
          >
            <label className="block">
              <span className="mb-1 block font-semibold">Ton besoin</span>
              <textarea required minLength={10} maxLength={3000} rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className={inputCls} placeholder="Décris ce que tu veux, en quelle quantité, pour quand." />
            </label>
            <label className="block">
              <span className="mb-1 block font-semibold">Téléphone (facultatif)</span>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
            </label>
            <FormError message={send.error ? errorMessage(send.error) : null} />
            <button type="submit" disabled={send.isPending} className={btn("primary", "lg", "w-full")}>
              {send.isPending ? "Envoi…" : "Envoyer la demande"}
            </button>
          </form>
        )}
      </div>
    </Panel>
  );
}

export const PANELS: Record<Offer["offer_type"], ComponentType<PanelProps>> = {
  PHYSICAL_PRODUCT: PhysicalPanel,
  SERVICE: ServicePanel,
  BOOKING: BookingPanel,
  DIGITAL_PRODUCT: DigitalPanel,
};
