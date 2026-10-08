import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import { OfferCard, OfferCardSkeleton } from "../../components/offers/OfferCard";
import { Icon } from "../../components/ui/Icon";
import { EmptyState, ErrorState, Field, FormError, Pagination, Spinner, StatusBadge } from "../../components/ui/kit";
import { btn, inputCls } from "../../components/ui/styles";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { api } from "../../services/api";
import type { Address, AddressInput, Booking, Offer, Order, Paged, Quote, Review, User } from "../../types";
import { errorMessage, fmtDate, fmtDateTime, money, toDate } from "../../utils/format";
import { BOOKING_STATUS, ORDER_STATUS, PAYMENT_STATUS, QUOTE_STATUS } from "../../utils/labels";

function Heading({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <header className="mb-6">
      <h2 className="text-3xl">{children}</h2>
      {sub && <p className="mt-1 text-muted">{sub}</p>}
    </header>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl bg-white p-5">{children}</div>;
}

/* ---------- Profil ---------- */

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ full_name: user?.full_name ?? "", email: user?.email ?? "" });
  const save = useMutation({
    mutationFn: () => api<User>("/users/me", { method: "PATCH", body: form }),
    onSuccess: (u) => {
      setUser(u);
      toast.push("Profil mis à jour.");
    },
  });

  return (
    <>
      <Heading sub={user ? `Membre depuis le ${fmtDate(user.created_at)}` : undefined}>Mon profil</Heading>
      <Card>
        <form
          className="grid max-w-xl gap-4"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field label="Nom complet">
            <input required minLength={2} className={inputCls} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <Field label="Adresse e-mail">
            <input required type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <FormError message={save.error ? errorMessage(save.error) : null} />
          <div>
            <button type="submit" disabled={save.isPending} className={btn("primary")}>
              {save.isPending ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </Card>
    </>
  );
}

/* ---------- Commandes ---------- */

function OrderCard({ order }: { order: Order }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const cancel = useMutation({
    mutationFn: () => api<Order>(`/orders/${order.id}/cancel`, { method: "POST" }),
    onSuccess: () => {
      toast.push(`Commande n°${order.id} annulée.`);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      queryClient.invalidateQueries({ queryKey: ["offer"] });
    },
  });
  const cancellable = order.status === "PENDING" || order.status === "CONFIRMED";

  return (
    <li className="rounded-2xl bg-white">
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 p-5 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-bold">Commande n°{order.id}</span>
            <span className="text-sm text-muted">
              {fmtDate(order.created_at)} · {order.items.length} ligne{order.items.length > 1 ? "s" : ""}
            </span>
          </span>
          <StatusBadge {...ORDER_STATUS[order.status]} />
          <span className="tnum text-lg font-bold">{money(order.total, order.currency)}</span>
          <Icon name="down" size={20} className="transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-nuit/10 p-5">
          <ul className="divide-y divide-nuit/10">
            {order.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-4 py-2.5">
                <span>
                  {i.offer_snapshot.slug ? (
                    <Link to={`/offers/${i.offer_snapshot.slug}`} className="font-semibold hover:underline">
                      {i.offer_snapshot.title}
                    </Link>
                  ) : (
                    i.offer_snapshot.title
                  )}
                  {i.quantity > 1 && <span className="text-muted"> × {i.quantity}</span>}
                </span>
                <span className="tnum font-semibold">{money(i.line_total, order.currency)}</span>
              </li>
            ))}
          </ul>
          <dl className="tnum mt-3 space-y-1 border-t border-nuit/10 pt-3 text-sm">
            <div className="flex justify-between">
              <dt>Livraison</dt>
              <dd>{order.shipping_address ? (order.shipping_cost === 0 ? "Offerte" : money(order.shipping_cost, order.currency)) : "Sans objet"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Paiement</dt>
              <dd>
                <StatusBadge {...PAYMENT_STATUS[order.payment_status]} />
              </dd>
            </div>
          </dl>
          {order.shipping_address && (
            <p className="mt-3 text-sm text-muted">
              Livré à : {order.shipping_address.line1}, {order.shipping_address.postal_code} {order.shipping_address.city}
            </p>
          )}
          {cancellable && (
            <div className="mt-4">
              <FormError message={cancel.error ? errorMessage(cancel.error) : null} />
              {confirming ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold">Annuler cette commande ?</span>
                  <button type="button" className={btn("danger", "sm")} disabled={cancel.isPending} onClick={() => cancel.mutate()}>
                    Oui, annuler
                  </button>
                  <button type="button" className={btn("ghost", "sm")} onClick={() => setConfirming(false)}>
                    Non, garder
                  </button>
                </div>
              ) : (
                <button type="button" className={btn("secondary", "sm")} onClick={() => setConfirming(true)}>
                  Annuler la commande
                </button>
              )}
            </div>
          )}
        </div>
      </details>
    </li>
  );
}

function useOrders(page: number, pageSize: number) {
  return useQuery({
    queryKey: ["orders", "list", page, pageSize],
    queryFn: () => api<Paged<Order>>("/orders", { params: { page, page_size: pageSize } }),
  });
}

export function OrdersPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useOrders(page, 10);
  return (
    <>
      <Heading>Mes commandes</Heading>
      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data && data.items.length === 0 ? (
        <EmptyState title="Aucune commande pour l'instant" action={{ to: "/explorer", label: "Explorer les offres" }}>
          Tes commandes apparaîtront ici dès ton premier achat.
        </EmptyState>
      ) : (
        <>
          <ul className="space-y-3">{data?.items.map((o) => <OrderCard key={o.id} order={o} />)}</ul>
          <Pagination page={data?.page ?? 1} pages={data?.pages ?? 1} onChange={setPage} />
        </>
      )}
    </>
  );
}

export function ServicesPage() {
  const { data, isLoading, error, refetch } = useOrders(1, 50);
  const rows = (data?.items ?? []).flatMap((o) =>
    o.items.filter((i) => i.offer_snapshot.offer_type === "SERVICE").map((i) => ({ order: o, item: i })),
  );
  return (
    <>
      <Heading sub="Les prestations que tu as commandées et l'avancement de chaque commande.">Services commandés</Heading>
      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="Aucun service commandé" action={{ to: "/explorer?type=SERVICE", label: "Voir les services" }}>
          Quand tu commandes un service, il apparaît ici avec ta demande.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ order, item }) => (
            <li key={item.id}>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link to={`/offers/${item.offer_snapshot.slug}`} className="text-lg font-bold hover:underline">
                    {item.offer_snapshot.title}
                    {item.quantity > 1 && <span className="font-normal text-muted"> × {item.quantity}</span>}
                  </Link>
                  <StatusBadge {...ORDER_STATUS[order.status]} />
                </div>
                <p className="mt-1 text-sm text-muted">
                  Commande n°{order.id} du {fmtDate(order.created_at)}
                </p>
                {typeof item.metadata.details === "string" && item.metadata.details && (
                  <p className="mt-3 rounded-lg bg-brume p-3">{item.metadata.details}</p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ---------- Réservations ---------- */

export function BookingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["bookings"], queryFn: () => api<Booking[]>("/bookings") });
  const cancel = useMutation({
    mutationFn: (id: number) => api<Booking>(`/bookings/${id}/cancel`, { method: "POST" }),
    onSuccess: () => {
      toast.push("Réservation annulée.");
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["slots"] });
      queryClient.invalidateQueries({ queryKey: ["offers"] });
    },
    onError: (e) => toast.push(errorMessage(e), "error"),
  });

  return (
    <>
      <Heading>Mes réservations</Heading>
      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data && data.length === 0 ? (
        <EmptyState title="Aucune réservation" action={{ to: "/explorer?type=BOOKING", label: "Voir les créneaux" }}>
          Réserve une séance, un cours ou un rendez-vous : il apparaîtra ici.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {data?.map((b) => {
            const active = (b.status === "PENDING" || b.status === "ACCEPTED") && toDate(b.starts_at) > new Date();
            return (
              <li key={b.id}>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link to={`/offers/${b.offer_slug}`} className="text-lg font-bold hover:underline">
                      {b.offer_title}
                    </Link>
                    <StatusBadge {...BOOKING_STATUS[b.status]} />
                  </div>
                  <p className="mt-1 flex items-center gap-2 capitalize">
                    <Icon name="calendar" size={18} className="text-muted" />
                    {fmtDateTime(b.starts_at)}
                  </p>
                  {b.notes && <p className="mt-2 text-muted">« {b.notes} »</p>}
                  {active && (
                    <button type="button" className={btn("secondary", "sm", "mt-4")} disabled={cancel.isPending} onClick={() => cancel.mutate(b.id)}>
                      Annuler la réservation
                    </button>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/* ---------- Devis ---------- */

export function QuotesPage() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["quotes"], queryFn: () => api<Quote[]>("/quote-requests") });
  return (
    <>
      <Heading>Demandes de devis</Heading>
      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data && data.length === 0 ? (
        <EmptyState title="Aucune demande de devis">Les offres « sur devis » proposent un formulaire sur leur page.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {data?.map((q) => (
            <li key={q.id}>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-lg font-bold">{q.offer_title}</p>
                  <StatusBadge {...QUOTE_STATUS[q.status]} />
                </div>
                <p className="mt-1 text-sm text-muted">Envoyée le {fmtDate(q.created_at)}</p>
                <p className="mt-3 rounded-lg bg-brume p-3">{q.message}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ---------- Favoris ---------- */

export function FavoritesPage() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["favorites", "list"], queryFn: () => api<Offer[]>("/favorites") });
  return (
    <>
      <Heading>Mes favoris</Heading>
      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <OfferCardSkeleton />
            </li>
          ))}
        </ul>
      ) : data && data.length === 0 ? (
        <EmptyState title="Aucun favori" action={{ to: "/explorer", label: "Explorer les offres" }}>
          Touche le cœur d'une offre pour la retrouver ici.
        </EmptyState>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {data?.map((o) => (
            <li key={o.id}>
              <OfferCard offer={o} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ---------- Avis ---------- */

export function ReviewsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["reviews", "mine"], queryFn: () => api<Review[]>("/users/me/reviews") });
  const remove = useMutation({
    mutationFn: (id: number) => api<void>(`/reviews/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.push("Avis supprimé.");
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      queryClient.invalidateQueries({ queryKey: ["offer"] });
    },
    onError: (e) => toast.push(errorMessage(e), "error"),
  });

  return (
    <>
      <Heading>Mes avis</Heading>
      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data && data.length === 0 ? (
        <EmptyState title="Aucun avis publié">Tu peux noter une offre depuis sa page.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {data?.map((r) => (
            <li key={r.id}>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link to={`/offers/${r.offer_slug}`} className="text-lg font-bold hover:underline">
                    {r.offer_title}
                  </Link>
                  <span className="flex" aria-label={`Note : ${r.rating} sur 5`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Icon key={i} name="star" size={18} className={i < r.rating ? "text-safran" : "text-nuit/20"} />
                    ))}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">Publié le {fmtDate(r.created_at)}</p>
                {r.comment && <p className="mt-3">{r.comment}</p>}
                <button type="button" className={btn("ghost", "sm", "mt-3 -ml-3.5 text-corail")} onClick={() => remove.mutate(r.id)} disabled={remove.isPending}>
                  <Icon name="trash" size={16} /> Supprimer
                </button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ---------- Adresses ---------- */

const EMPTY_ADDRESS: AddressInput = { label: "Domicile", line1: "", line2: "", city: "", postal_code: "", country: "Madagascar", is_default: false };

function AddressForm({ initial, onDone }: { initial?: Address; onDone: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<AddressInput>(initial ? { ...initial, line2: initial.line2 ?? "" } : EMPTY_ADDRESS);
  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, line2: form.line2?.trim() || null };
      return initial
        ? api<Address>(`/users/me/addresses/${initial.id}`, { method: "PUT", body })
        : api<Address>("/users/me/addresses", { method: "POST", body });
    },
    onSuccess: () => {
      toast.push("Adresse enregistrée.");
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      onDone();
    },
  });
  const set = (k: keyof AddressInput) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <Field label="Nom de l'adresse">
        <input required className={inputCls} value={form.label} onChange={set("label")} />
      </Field>
      <Field label="Adresse">
        <input required minLength={3} className={inputCls} value={form.line1} onChange={set("line1")} />
      </Field>
      <Field label="Complément (facultatif)" className="sm:col-span-2">
        <input className={inputCls} value={form.line2 ?? ""} onChange={set("line2")} />
      </Field>
      <Field label="Code postal">
        <input required className={inputCls} value={form.postal_code} onChange={set("postal_code")} />
      </Field>
      <Field label="Ville">
        <input required className={inputCls} value={form.city} onChange={set("city")} />
      </Field>
      <Field label="Pays" className="sm:col-span-2">
        <input required minLength={2} className={inputCls} value={form.country} onChange={set("country")} />
      </Field>
      <label className="flex items-center gap-3 sm:col-span-2">
        <input type="checkbox" className="h-5 w-5 accent-cobalt" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
        Utiliser comme adresse principale
      </label>
      <div className="sm:col-span-2">
        <FormError message={save.error ? errorMessage(save.error) : null} />
      </div>
      <div className="flex gap-3 sm:col-span-2">
        <button type="submit" disabled={save.isPending} className={btn("primary")}>
          Enregistrer
        </button>
        <button type="button" className={btn("ghost")} onClick={onDone}>
          Annuler
        </button>
      </div>
    </form>
  );
}

export function AddressesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["addresses"], queryFn: () => api<Address[]>("/users/me/addresses") });
  const remove = useMutation({
    mutationFn: (id: number) => api<void>(`/users/me/addresses/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.push("Adresse supprimée.");
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
    },
    onError: (e) => toast.push(errorMessage(e), "error"),
  });

  return (
    <>
      <Heading>Mes adresses</Heading>
      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <div className="space-y-3">
          {data?.map((a) => (
            <Card key={a.id}>
              {editing !== "new" && editing && typeof editing !== "string" && editing.id === a.id ? (
                <AddressForm initial={a} onDone={() => setEditing(null)} />
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-bold">
                      {a.label}
                      {a.is_default && <StatusBadge label="Principale" tone="info" />}
                    </p>
                    <p className="text-muted">
                      {a.line1}
                      {a.line2 ? `, ${a.line2}` : ""}
                      <br />
                      {a.postal_code} {a.city}, {a.country}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className={btn("secondary", "sm")} onClick={() => setEditing(a)}>
                      Modifier
                    </button>
                    <button type="button" className={btn("ghost", "sm", "text-corail")} onClick={() => remove.mutate(a.id)} aria-label={`Supprimer l'adresse ${a.label}`}>
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </div>
              )}
            </Card>
          ))}
          {editing === "new" ? (
            <Card>
              <AddressForm onDone={() => setEditing(null)} />
            </Card>
          ) : (
            <button type="button" className={btn("primary")} onClick={() => setEditing("new")}>
              <Icon name="plus" size={18} /> Ajouter une adresse
            </button>
          )}
        </div>
      )}
    </>
  );
}

/* ---------- Paramètres ---------- */

export function SettingsPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ current_password: "", new_password: "" });
  const change = useMutation({
    mutationFn: () => api<{ detail: string }>("/users/me/password", { method: "POST", body: form }),
    onSuccess: (r) => {
      toast.push(r.detail);
      setForm({ current_password: "", new_password: "" });
    },
  });

  return (
    <>
      <Heading>Paramètres</Heading>
      <div className="space-y-6">
        <Card>
          <h3 className="mb-4 text-xl font-bold">Changer de mot de passe</h3>
          <form
            className="grid max-w-md gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              change.mutate();
            }}
          >
            <Field label="Mot de passe actuel">
              <input required type="password" autoComplete="current-password" className={inputCls} value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} />
            </Field>
            <Field label="Nouveau mot de passe" hint="8 caractères minimum.">
              <input required minLength={8} type="password" autoComplete="new-password" className={inputCls} value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} />
            </Field>
            <FormError message={change.error ? errorMessage(change.error) : null} />
            <div>
              <button type="submit" disabled={change.isPending} className={btn("primary")}>
                Modifier le mot de passe
              </button>
            </div>
          </form>
        </Card>
        <Card>
          <h3 className="mb-3 text-xl font-bold">Session</h3>
          <button
            type="button"
            className={btn("secondary")}
            onClick={() => {
              logout();
              navigate("/", { replace: true });
            }}
          >
            <Icon name="logout" size={18} /> Se déconnecter
          </button>
        </Card>
      </div>
    </>
  );
}
