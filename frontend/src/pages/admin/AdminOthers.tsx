import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { Icon } from "../../components/ui/Icon";
import { EmptyState, ErrorState, Field, FormError, Pagination, Seo, Spinner, StatusBadge } from "../../components/ui/kit";
import { btn, inputCls } from "../../components/ui/styles";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { OFFER_TYPES, TYPE_ORDER, type OfferType } from "../../offers/offerTypes";
import { api } from "../../services/api";
import type { Booking, BookingStatus, Category, Order, OrderStatus, Paged, Quote, QuoteStatus, Role, User } from "../../types";
import { errorMessage, fmtDate, fmtDateTime, money } from "../../utils/format";
import {
  BOOKING_STATUS,
  BOOKING_STATUSES,
  ORDER_STATUS,
  ORDER_STATUSES,
  PAYMENT_STATUS,
  QUOTE_STATUS,
  QUOTE_STATUSES,
  ROLE_LABEL,
} from "../../utils/labels";

function Head({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <Seo title={`${title} · Administration`} />
      <h1 className="text-4xl sm:text-5xl">{title}</h1>
      {children}
    </div>
  );
}

function StatusSelect<T extends string>({
  value,
  options,
  labels,
  onChange,
  disabled,
  label,
}: {
  value: T;
  options: T[];
  labels: Record<T, { label: string }>;
  onChange: (v: T) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <select aria-label={label} className={`${inputCls} !w-auto !py-1.5`} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {labels[o].label}
        </option>
      ))}
    </select>
  );
}

/* --------------------------------------------------------------- Catégories */

interface CategoryForm {
  name: string;
  applies_to: OfferType[];
  position: string;
  is_active: boolean;
}
const NEW_CATEGORY: CategoryForm = { name: "", applies_to: [], position: "0", is_active: true };

export function AdminCategoriesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<CategoryForm>(NEW_CATEGORY);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => api<Category[]>("/admin/categories"),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  };

  const save = useMutation({
    mutationFn: () => {
      const body = { name: form.name.trim(), applies_to: form.applies_to, position: Number(form.position || 0), is_active: form.is_active };
      return editing === "new"
        ? api<Category>("/admin/categories", { method: "POST", body })
        : api<Category>(`/admin/categories/${editing}`, { method: "PUT", body });
    },
    onSuccess: () => {
      toast.push("Catégorie enregistrée.");
      setEditing(null);
      refresh();
    },
  });

  const remove = useMutation({
    mutationFn: (c: Category) => api<void>(`/admin/categories/${c.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.push("Catégorie supprimée.");
      refresh();
    },
    onError: (e) => toast.push(errorMessage(e), "error"),
  });

  function open(c: Category | null) {
    setForm(c ? { name: c.name, applies_to: c.applies_to, position: String(c.position), is_active: c.is_active } : NEW_CATEGORY);
    setEditing(c ? c.id : "new");
    save.reset();
  }

  const toggleType = (t: OfferType) =>
    setForm((f) => ({ ...f, applies_to: f.applies_to.includes(t) ? f.applies_to.filter((x) => x !== t) : [...f.applies_to, t] }));

  return (
    <>
      <Head title="Catégories">
        <button type="button" className={btn("primary", "md")} onClick={() => open(null)}>
          <Icon name="plus" size={18} /> Nouvelle catégorie
        </button>
      </Head>

      {editing !== null && (
        <form
          className="mt-6 grid gap-4 rounded-2xl bg-white p-5 sm:p-6"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <h2 className="text-2xl">{editing === "new" ? "Nouvelle catégorie" : "Modifier la catégorie"}</h2>
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <Field label="Nom">
              <input required minLength={2} className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Position">
              <input type="number" className={inputCls} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
            </Field>
          </div>
          <fieldset>
            <legend className="mb-1 text-sm font-semibold">S'applique à</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {TYPE_ORDER.map((t) => (
                <label key={t} className="flex items-center gap-2">
                  <input type="checkbox" className="h-5 w-5 accent-cobalt" checked={form.applies_to.includes(t)} onChange={() => toggleType(t)} />
                  {OFFER_TYPES[t].label}
                </label>
              ))}
            </div>
            <p className="mt-1 text-sm text-muted">Aucune case cochée : la catégorie est proposée pour tous les types.</p>
          </fieldset>
          <label className="flex items-center gap-3 font-semibold">
            <input type="checkbox" className="h-5 w-5 accent-cobalt" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Active
          </label>
          <FormError message={save.error ? errorMessage(save.error) : null} />
          <div className="flex gap-3">
            <button type="submit" className={btn("primary", "md")} disabled={save.isPending}>
              Enregistrer
            </button>
            <button type="button" className={btn("secondary", "md")} onClick={() => setEditing(null)}>
              Annuler
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <Spinner />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState title="Aucune catégorie">Crée la première pour classer tes offres.</EmptyState>
      ) : (
        <ul className="mt-6 divide-y divide-nuit/10 rounded-2xl bg-white">
          {data.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
              <div className="min-w-0 flex-1 basis-52">
                <p className="font-semibold">{c.name}</p>
                <p className="text-sm text-muted">
                  {c.offer_count} offre{c.offer_count > 1 ? "s" : ""} ·{" "}
                  {c.applies_to.length ? c.applies_to.map((t) => OFFER_TYPES[t].label).join(", ") : "tous types"}
                </p>
              </div>
              {!c.is_active && <StatusBadge label="Inactive" tone="neutral" />}
              <div className="flex gap-2">
                <button type="button" className={btn("secondary", "sm")} onClick={() => open(c)}>
                  Modifier
                </button>
                <button
                  type="button"
                  aria-label={`Supprimer ${c.name}`}
                  className={btn("danger", "sm")}
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm(`Supprimer la catégorie « ${c.name} » ?`)) remove.mutate(c);
                  }}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- Commandes */

export function AdminOrdersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "orders", { status, page }],
    queryFn: () => api<Paged<Order>>("/admin/orders", { params: { status, page, page_size: 20 } }),
  });

  const change = useMutation({
    mutationFn: ({ id, status }: { id: number; status: OrderStatus }) =>
      api<Order>(`/admin/orders/${id}/status`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      toast.push("Statut mis à jour.");
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["offers"] });
    },
    onError: (e) => toast.push(errorMessage(e), "error"),
  });

  return (
    <>
      <Head title="Commandes">
        <select
          aria-label="Filtrer par statut"
          className={`${inputCls} !w-auto`}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as OrderStatus | "");
            setPage(1);
          }}
        >
          <option value="">Tous les statuts</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS[s].label}
            </option>
          ))}
        </select>
      </Head>

      {isLoading ? (
        <Spinner />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState title="Aucune commande">Elles apparaîtront ici dès le premier achat.</EmptyState>
      ) : (
        <>
          <ul className="mt-6 grid gap-4">
            {data.items.map((o) => (
              <li key={o.id} className="rounded-2xl bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-bold">
                      Commande n°{o.id} · <span className="tnum">{money(o.total, o.currency)}</span>
                    </p>
                    <p className="text-sm text-muted">
                      {fmtDateTime(o.created_at)} · {o.user_name ?? o.customer_info.full_name} ({o.user_email ?? o.customer_info.email})
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge {...PAYMENT_STATUS[o.payment_status]} />
                    <StatusSelect
                      label={`Statut de la commande ${o.id}`}
                      value={o.status}
                      options={ORDER_STATUSES}
                      labels={ORDER_STATUS}
                      disabled={change.isPending}
                      onChange={(s) => change.mutate({ id: o.id, status: s })}
                    />
                  </div>
                </div>
                <ul className="mt-3 divide-y divide-nuit/10 border-t border-nuit/10">
                  {o.items.map((i) => (
                    <li key={i.id} className="flex justify-between gap-4 py-2">
                      <span>
                        {i.offer_snapshot.title}
                        {i.quantity > 1 && <span className="text-muted"> × {i.quantity}</span>}
                        {typeof i.metadata.starts_at === "string" && <span className="text-sm text-muted"> · {fmtDateTime(i.metadata.starts_at)}</span>}
                      </span>
                      <span className="tnum font-semibold">{money(i.line_total, o.currency)}</span>
                    </li>
                  ))}
                </ul>
                {o.shipping_address && (
                  <p className="mt-2 text-sm text-muted">
                    Livraison : {o.shipping_address.line1}
                    {o.shipping_address.line2 ? `, ${o.shipping_address.line2}` : ""}, {o.shipping_address.postal_code} {o.shipping_address.city}
                  </p>
                )}
                {o.notes && <p className="mt-1 text-sm">Note du client : {o.notes}</p>}
              </li>
            ))}
          </ul>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------- Réservations */

export function AdminBookingsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<BookingStatus | "">("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "bookings", { status, page }],
    queryFn: () => api<Paged<Booking>>("/admin/bookings", { params: { status, page, page_size: 20 } }),
  });

  const change = useMutation({
    mutationFn: ({ id, status }: { id: number; status: BookingStatus }) =>
      api<Booking>(`/admin/bookings/${id}/status`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      toast.push("Réservation mise à jour.");
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["slots"] });
    },
    onError: (e) => toast.push(errorMessage(e), "error"),
  });

  return (
    <>
      <Head title="Réservations">
        <select
          aria-label="Filtrer par statut"
          className={`${inputCls} !w-auto`}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as BookingStatus | "");
            setPage(1);
          }}
        >
          <option value="">Tous les statuts</option>
          {BOOKING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {BOOKING_STATUS[s].label}
            </option>
          ))}
        </select>
      </Head>

      {isLoading ? (
        <Spinner />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState title="Aucune réservation">Les créneaux réservés apparaîtront ici.</EmptyState>
      ) : (
        <>
          <ul className="mt-6 divide-y divide-nuit/10 rounded-2xl bg-white">
            {data.items.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <div className="min-w-0 flex-1 basis-60">
                  <p className="font-semibold">{b.offer_title}</p>
                  <p className="text-sm text-muted">
                    {fmtDateTime(b.starts_at)} · {b.user_name} ({b.user_email})
                  </p>
                  {b.notes && <p className="text-sm">« {b.notes} »</p>}
                </div>
                <StatusSelect
                  label={`Statut de la réservation ${b.id}`}
                  value={b.status}
                  options={BOOKING_STATUSES}
                  labels={BOOKING_STATUS}
                  disabled={change.isPending}
                  onChange={(s) => change.mutate({ id: b.id, status: s })}
                />
              </li>
            ))}
          </ul>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </>
  );
}

/* -------------------------------------------------------------------- Devis */

export function AdminQuotesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<QuoteStatus | "">("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "quotes", status],
    queryFn: () => api<Quote[]>("/admin/quote-requests", { params: { status } }),
  });

  const change = useMutation({
    mutationFn: ({ id, status }: { id: number; status: QuoteStatus }) =>
      api<Quote>(`/admin/quote-requests/${id}/status`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      toast.push("Demande mise à jour.");
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
    onError: (e) => toast.push(errorMessage(e), "error"),
  });

  return (
    <>
      <Head title="Demandes de devis">
        <select aria-label="Filtrer par statut" className={`${inputCls} !w-auto`} value={status} onChange={(e) => setStatus(e.target.value as QuoteStatus | "")}>
          <option value="">Tous les statuts</option>
          {QUOTE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {QUOTE_STATUS[s].label}
            </option>
          ))}
        </select>
      </Head>

      {isLoading ? (
        <Spinner />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState title="Aucune demande">Les demandes de devis des clients apparaîtront ici.</EmptyState>
      ) : (
        <ul className="mt-6 grid gap-4">
          {data.map((q) => (
            <li key={q.id} className="rounded-2xl bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{q.offer_title}</p>
                  <p className="text-sm text-muted">
                    {fmtDateTime(q.created_at)} · {q.user_name} (
                    <a className="underline" href={`mailto:${q.user_email}`}>
                      {q.user_email}
                    </a>
                    )
                    {q.phone && <> · {q.phone}</>}
                  </p>
                </div>
                <StatusSelect
                  label={`Statut de la demande ${q.id}`}
                  value={q.status}
                  options={QUOTE_STATUSES}
                  labels={QUOTE_STATUS}
                  disabled={change.isPending}
                  onChange={(s) => change.mutate({ id: q.id, status: s })}
                />
              </div>
              <p className="mt-3 whitespace-pre-line">{q.message}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ------------------------------------------------------------ Utilisateurs */

export function AdminUsersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "users", { search, page }],
    queryFn: () => api<Paged<User>>("/admin/users", { params: { q: search, page, page_size: 20 } }),
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: number; role?: Role; is_active?: boolean }) =>
      api<User>(`/admin/users/${id}`, { method: "PATCH", body }),
    onSuccess: () => {
      toast.push("Utilisateur mis à jour.");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e) => toast.push(errorMessage(e), "error"),
  });

  const roles: Role[] = ["USER", "PROVIDER", "ADMIN"];

  return (
    <>
      <Head title="Utilisateurs" />
      <input
        type="search"
        aria-label="Rechercher un utilisateur"
        placeholder="Nom ou adresse e-mail…"
        className={`${inputCls} mt-6 max-w-md`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {isLoading ? (
        <Spinner />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState title="Aucun utilisateur">Aucun résultat pour cette recherche.</EmptyState>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-nuit/10 rounded-2xl bg-white">
            {data.items.map((u) => {
              const self = u.id === me?.id;
              return (
                <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="truncate font-semibold">
                      {u.full_name} {self && <span className="text-sm font-normal text-muted">(toi)</span>}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {u.email} · inscrit le {fmtDate(u.created_at)}
                    </p>
                  </div>
                  {!u.is_active && <StatusBadge label="Désactivé" tone="bad" />}
                  <select
                    aria-label={`Rôle de ${u.full_name}`}
                    className={`${inputCls} !w-auto !py-1.5`}
                    value={u.role}
                    disabled={self || update.isPending}
                    onChange={(e) => update.mutate({ id: u.id, role: e.target.value as Role })}
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={btn(u.is_active ? "danger" : "secondary", "sm")}
                    disabled={self || update.isPending}
                    onClick={() => update.mutate({ id: u.id, is_active: !u.is_active })}
                  >
                    {u.is_active ? "Désactiver" : "Réactiver"}
                  </button>
                </li>
              );
            })}
          </ul>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </>
  );
}
