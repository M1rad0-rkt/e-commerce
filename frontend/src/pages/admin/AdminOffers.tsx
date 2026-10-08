import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Icon } from "../../components/ui/Icon";
import { EmptyState, ErrorState, Field, FormError, Pagination, Seo, Spinner, StatusBadge, TypeBadge } from "../../components/ui/kit";
import { btn, inputCls } from "../../components/ui/styles";
import { useToast } from "../../context/ToastContext";
import { useCategories } from "../../hooks/queries";
import { OFFER_TYPES, TYPE_ORDER, type OfferType, type PriceMode } from "../../offers/offerTypes";
import { api } from "../../services/api";
import type { Offer, OfferPage, Slot } from "../../types";
import { errorMessage, fmtDateTime, priceText } from "../../utils/format";

/* ------------------------------------------------------------------ Liste */

export function AdminOffersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<OfferType | "">("");
  const [state, setState] = useState<"all" | "published" | "draft">("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "offers", { search, type, state, page }],
    queryFn: () => api<OfferPage>("/admin/offers", { params: { q: search, type, state, page, page_size: 20 } }),
  });

  const publish = useMutation({
    mutationFn: (o: Offer) => api<Offer>(`/admin/offers/${o.id}/status`, { method: "PATCH", body: { is_active: !o.is_active } }),
    onSuccess: (o) => {
      toast.push(o.is_active ? "Offre publiée." : "Offre repassée en brouillon.");
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["offers"] });
    },
    onError: (e) => toast.push(errorMessage(e), "error"),
  });

  const remove = useMutation({
    mutationFn: (o: Offer) => api<void>(`/admin/offers/${o.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.push("Offre supprimée.");
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["offers"] });
    },
    onError: (e) => toast.push(errorMessage(e), "error"),
  });

  return (
    <>
      <Seo title="Offres · Administration" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl sm:text-5xl">Offres</h1>
        <Link to="/admin/offres/nouvelle" className={btn("primary", "md")}>
          <Icon name="plus" size={18} /> Nouvelle offre
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_12rem_11rem]">
        <input
          type="search"
          aria-label="Rechercher une offre"
          placeholder="Rechercher par titre…"
          className={inputCls}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="Type d'offre"
          className={inputCls}
          value={type}
          onChange={(e) => {
            setType(e.target.value as OfferType | "");
            setPage(1);
          }}
        >
          <option value="">Tous les types</option>
          {TYPE_ORDER.map((t) => (
            <option key={t} value={t}>
              {OFFER_TYPES[t].label}
            </option>
          ))}
        </select>
        <select
          aria-label="État"
          className={inputCls}
          value={state}
          onChange={(e) => {
            setState(e.target.value as typeof state);
            setPage(1);
          }}
        >
          <option value="all">Tous les états</option>
          <option value="published">Publiées</option>
          <option value="draft">Brouillons</option>
        </select>
      </div>

      {isLoading ? (
        <Spinner />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState title="Aucune offre" action={{ to: "/admin/offres/nouvelle", label: "Créer une offre" }}>
          Aucune offre ne correspond à ces filtres.
        </EmptyState>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted">{data.total} offre{data.total > 1 ? "s" : ""}</p>
          <ul className="mt-2 divide-y divide-nuit/10 rounded-2xl bg-white">
            {data.items.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <div className="min-w-0 flex-1 basis-60">
                  <p className="truncate font-semibold">{o.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                    <TypeBadge type={o.offer_type} />
                    <span className="tnum">{priceText(o)}</span>
                    {o.category && <span>· {o.category.name}</span>}
                  </p>
                </div>
                <StatusBadge label={o.is_active ? "Publiée" : "Brouillon"} tone={o.is_active ? "good" : "neutral"} />
                <div className="flex gap-2">
                  <Link to={`/admin/offres/${o.id}`} className={btn("secondary", "sm")}>
                    Modifier
                  </Link>
                  <button type="button" className={btn("ghost", "sm")} disabled={publish.isPending} onClick={() => publish.mutate(o)}>
                    {o.is_active ? "Dépublier" : "Publier"}
                  </button>
                  <button
                    type="button"
                    aria-label={`Supprimer ${o.title}`}
                    className={btn("danger", "sm")}
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(`Supprimer « ${o.title} » définitivement ?`)) remove.mutate(o);
                    }}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- Formulaire */

interface FormState {
  title: string;
  description: string;
  offer_type: OfferType;
  price_mode: PriceMode;
  price: string;
  old_price: string;
  category_id: string;
  image: string;
  is_featured: boolean;
  is_active: boolean;
  sku: string;
  stock: string;
  weight_g: string;
  provider_name: string;
  duration: string;
  duration_minutes: string;
  delivery: string;
  location: string;
  format: string;
  file_size: string;
  license: string;
  included: string;
  specs: string;
}

const EMPTY: FormState = {
  title: "",
  description: "",
  offer_type: "PHYSICAL_PRODUCT",
  price_mode: "FIXED",
  price: "",
  old_price: "",
  category_id: "",
  image: "",
  is_featured: false,
  is_active: false,
  sku: "",
  stock: "0",
  weight_g: "",
  provider_name: "",
  duration: "",
  duration_minutes: "",
  delivery: "",
  location: "",
  format: "",
  file_size: "",
  license: "",
  included: "",
  specs: "",
};

const specsToText = (s?: Record<string, string>) =>
  s ? Object.entries(s).map(([k, v]) => `${k} : ${v}`).join("\n") : "";

function textToSpecs(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const i = line.indexOf(":");
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    if (key && value) out[key] = value;
  }
  return out;
}

function fromOffer(o: Offer): FormState {
  const a = o.attributes;
  return {
    title: o.title,
    description: o.description,
    offer_type: o.offer_type,
    price_mode: o.price_mode,
    price: o.price === null ? "" : String(o.price),
    old_price: o.old_price === null ? "" : String(o.old_price),
    category_id: o.category ? String(o.category.id) : "",
    image: o.image ?? "",
    is_featured: o.is_featured,
    is_active: o.is_active,
    sku: o.physical?.sku ?? "",
    stock: String(o.physical?.stock ?? 0),
    weight_g: o.physical?.weight_g ? String(o.physical.weight_g) : "",
    provider_name: a.provider_name ?? "",
    duration: a.duration ?? "",
    duration_minutes: a.duration_minutes ? String(a.duration_minutes) : "",
    delivery: a.delivery ?? "",
    location: a.location ?? "",
    format: a.format ?? "",
    file_size: a.file_size ?? "",
    license: a.license ?? "",
    included: (a.included ?? []).join("\n"),
    specs: specsToText(a.specs),
  };
}

function toPayload(f: FormState, existing?: Offer) {
  const attributes: Record<string, unknown> = { ...(existing?.attributes ?? {}) };
  const set = (key: string, value: unknown) => {
    if (value === "" || value === null || value === undefined || (Array.isArray(value) && value.length === 0)) delete attributes[key];
    else attributes[key] = value;
  };
  const lines = f.included.split("\n").map((s) => s.trim()).filter(Boolean);
  const specs = textToSpecs(f.specs);

  set("included", lines);
  set("provider_name", f.provider_name.trim());
  if (f.offer_type === "PHYSICAL_PRODUCT") {
    set("delivery", f.delivery.trim());
    set("specs", Object.keys(specs).length ? specs : "");
  }
  if (f.offer_type === "SERVICE" || f.offer_type === "BOOKING") {
    set("duration", f.duration.trim());
    set("duration_minutes", f.duration_minutes ? Number(f.duration_minutes) : "");
    set("location", f.location.trim());
  }
  if (f.offer_type === "DIGITAL_PRODUCT") {
    set("format", f.format.trim());
    set("file_size", f.file_size.trim());
    set("license", f.license.trim());
  }

  const quote = f.price_mode === "QUOTE";
  return {
    title: f.title.trim(),
    description: f.description.trim(),
    offer_type: f.offer_type,
    price_mode: f.price_mode,
    price: quote || f.price === "" ? null : Number(f.price),
    old_price: quote || f.old_price === "" ? null : Number(f.old_price),
    category_id: f.category_id ? Number(f.category_id) : null,
    image: f.image.trim() || null,
    is_featured: f.is_featured,
    attributes,
    physical:
      f.offer_type === "PHYSICAL_PRODUCT"
        ? { sku: f.sku.trim() || null, stock: Number(f.stock || 0), weight_g: f.weight_g ? Number(f.weight_g) : null, dimensions: existing?.physical?.dimensions ?? {} }
        : null,
  };
}

export function AdminOfferFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: categories } = useCategories();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loaded, setLoaded] = useState(!editing);

  const existing = useQuery({
    queryKey: ["admin", "offer", id],
    queryFn: () => api<Offer>(`/admin/offers/${id}`),
    enabled: editing,
  });

  useEffect(() => {
    if (existing.data) {
      setForm(fromOffer(existing.data));
      setLoaded(true);
    }
  }, [existing.data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = toPayload(form, existing.data);
      if (editing) {
        const saved = await api<Offer>(`/admin/offers/${id}`, { method: "PUT", body: payload });
        if (saved.is_active !== form.is_active) {
          return api<Offer>(`/admin/offers/${id}/status`, { method: "PATCH", body: { is_active: form.is_active } });
        }
        return saved;
      }
      return api<Offer>("/admin/offers", { method: "POST", body: { ...payload, is_active: form.is_active } });
    },
    onSuccess: (o) => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      toast.push(editing ? "Offre enregistrée." : "Offre créée.");
      if (!editing) navigate(`/admin/offres/${o.id}`, { replace: true });
    },
  });

  if (editing && existing.isLoading) return <Spinner />;
  if (editing && (existing.error || !loaded)) return <ErrorState error={existing.error} onRetry={() => existing.refetch()} />;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const type = form.offer_type;
  const quote = form.price_mode === "QUOTE";
  const cats = (categories ?? []).filter((c) => c.applies_to.length === 0 || c.applies_to.includes(type));

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <>
      <Seo title={editing ? "Modifier l'offre" : "Nouvelle offre"} />
      <Link to="/admin/offres" className="inline-flex items-center gap-1 font-semibold underline underline-offset-4">
        <Icon name="left" size={16} /> Toutes les offres
      </Link>
      <h1 className="mt-3 text-4xl sm:text-5xl">{editing ? "Modifier l'offre" : "Nouvelle offre"}</h1>

      <form onSubmit={onSubmit} className="mt-8 grid gap-6">
        <section className="grid gap-4 rounded-2xl bg-white p-5 sm:p-6">
          <h2 className="text-2xl">L'essentiel</h2>
          <Field label="Type d'offre">
            <select className={inputCls} value={type} onChange={(e) => set("offer_type", e.target.value as OfferType)}>
              {TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {OFFER_TYPES[t].label} — {OFFER_TYPES[t].description}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Titre">
            <input required minLength={3} maxLength={200} className={inputCls} value={form.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="Description">
            <textarea rows={6} className={inputCls} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Catégorie">
              <select className={inputCls} value={form.category_id} onChange={(e) => set("category_id", e.target.value)}>
                <option value="">Aucune</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Image (adresse https)" hint="Laisse vide : une illustration aux couleurs du type sera utilisée.">
              <input type="url" className={inputCls} placeholder="https://…" value={form.image} onChange={(e) => set("image", e.target.value)} />
            </Field>
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl bg-white p-5 sm:p-6">
          <h2 className="text-2xl">Prix</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Mode de prix">
              <select className={inputCls} value={form.price_mode} onChange={(e) => set("price_mode", e.target.value as PriceMode)}>
                <option value="FIXED">Prix fixe</option>
                <option value="STARTING_AT">À partir de</option>
                <option value="QUOTE">Sur devis</option>
              </select>
            </Field>
            <Field label="Prix (€)">
              <input
                type="number"
                min={0}
                step="0.01"
                required={!quote}
                disabled={quote}
                className={inputCls}
                value={quote ? "" : form.price}
                onChange={(e) => set("price", e.target.value)}
              />
            </Field>
            <Field label="Ancien prix (€)" hint="Affiche une remise barrée.">
              <input type="number" min={0} step="0.01" disabled={quote} className={inputCls} value={quote ? "" : form.old_price} onChange={(e) => set("old_price", e.target.value)} />
            </Field>
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl bg-white p-5 sm:p-6">
          <h2 className="text-2xl">Détails · {OFFER_TYPES[type].label.toLowerCase()}</h2>
          {type === "PHYSICAL_PRODUCT" && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Référence (SKU)">
                  <input className={inputCls} value={form.sku} onChange={(e) => set("sku", e.target.value)} />
                </Field>
                <Field label="Stock">
                  <input type="number" min={0} required className={inputCls} value={form.stock} onChange={(e) => set("stock", e.target.value)} />
                </Field>
                <Field label="Poids (g)">
                  <input type="number" min={0} className={inputCls} value={form.weight_g} onChange={(e) => set("weight_g", e.target.value)} />
                </Field>
              </div>
              <Field label="Livraison">
                <input className={inputCls} placeholder="Expédié sous 48 h" value={form.delivery} onChange={(e) => set("delivery", e.target.value)} />
              </Field>
              <Field label="Caractéristiques" hint="Une par ligne, au format « Nom : valeur ».">
                <textarea rows={4} className={inputCls} placeholder={"Matière : chêne\nHauteur : 42 cm"} value={form.specs} onChange={(e) => set("specs", e.target.value)} />
              </Field>
            </>
          )}
          {(type === "SERVICE" || type === "BOOKING") && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Durée (texte)">
                <input className={inputCls} placeholder="1 h 30" value={form.duration} onChange={(e) => set("duration", e.target.value)} />
              </Field>
              <Field label="Durée (minutes)">
                <input type="number" min={0} className={inputCls} value={form.duration_minutes} onChange={(e) => set("duration_minutes", e.target.value)} />
              </Field>
              <Field label="Lieu">
                <input className={inputCls} placeholder="À distance, en atelier…" value={form.location} onChange={(e) => set("location", e.target.value)} />
              </Field>
            </div>
          )}
          {type === "DIGITAL_PRODUCT" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Format">
                <input className={inputCls} placeholder="PDF" value={form.format} onChange={(e) => set("format", e.target.value)} />
              </Field>
              <Field label="Taille du fichier">
                <input className={inputCls} placeholder="12 Mo" value={form.file_size} onChange={(e) => set("file_size", e.target.value)} />
              </Field>
              <Field label="Licence">
                <input className={inputCls} placeholder="Usage personnel" value={form.license} onChange={(e) => set("license", e.target.value)} />
              </Field>
            </div>
          )}
          <Field label="Offreur (nom affiché)">
            <input className={inputCls} value={form.provider_name} onChange={(e) => set("provider_name", e.target.value)} />
          </Field>
          <Field label="Ce qui est inclus" hint="Un point par ligne.">
            <textarea rows={4} className={inputCls} value={form.included} onChange={(e) => set("included", e.target.value)} />
          </Field>
        </section>

        <section className="grid gap-3 rounded-2xl bg-white p-5 sm:p-6">
          <h2 className="text-2xl">Visibilité</h2>
          <label className="flex items-center gap-3 font-semibold">
            <input type="checkbox" className="h-5 w-5 accent-cobalt" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} />
            Publiée (visible dans la boutique)
          </label>
          <label className="flex items-center gap-3 font-semibold">
            <input type="checkbox" className="h-5 w-5 accent-cobalt" checked={form.is_featured} onChange={(e) => set("is_featured", e.target.checked)} />
            Mise en avant sur l'accueil
          </label>
        </section>

        <FormError message={save.error ? errorMessage(save.error) : null} />
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={save.isPending} className={btn("primary", "lg")}>
            {save.isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
          <Link to="/admin/offres" className={btn("secondary", "lg")}>
            Annuler
          </Link>
        </div>
      </form>

      {editing && type === "BOOKING" && id && <SlotsManager offerId={Number(id)} />}
    </>
  );
}

/* ------------------------------------------------------------------ Créneaux */

function SlotsManager({ offerId }: { offerId: number }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [start, setStart] = useState("");
  const [minutes, setMinutes] = useState("60");
  const [capacity, setCapacity] = useState("1");

  const slots = useQuery({
    queryKey: ["admin", "slots", offerId],
    queryFn: () => api<Slot[]>(`/admin/offers/${offerId}/slots`),
  });

  const add = useMutation({
    mutationFn: () => {
      const starts = new Date(start);
      const ends = new Date(starts.getTime() + Number(minutes) * 60_000);
      return api<Slot>(`/admin/offers/${offerId}/slots`, {
        method: "POST",
        body: { starts_at: starts.toISOString(), ends_at: ends.toISOString(), capacity: Number(capacity) },
      });
    },
    onSuccess: () => {
      toast.push("Créneau ajouté.");
      setStart("");
      queryClient.invalidateQueries({ queryKey: ["admin", "slots", offerId] });
      queryClient.invalidateQueries({ queryKey: ["slots"] });
    },
  });

  const remove = useMutation({
    mutationFn: (s: Slot) => api<void>(`/admin/slots/${s.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.push("Créneau supprimé.");
      queryClient.invalidateQueries({ queryKey: ["admin", "slots", offerId] });
      queryClient.invalidateQueries({ queryKey: ["slots"] });
    },
    onError: (e) => toast.push(errorMessage(e), "error"),
  });

  return (
    <section className="mt-10 rounded-2xl bg-white p-5 sm:p-6" aria-labelledby="slots-title">
      <h2 id="slots-title" className="text-2xl">
        Créneaux de réservation
      </h2>
      <form
        className="mt-4 grid items-end gap-3 sm:grid-cols-[1fr_8rem_8rem_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <Field label="Début">
          <input type="datetime-local" required className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Durée (min)">
          <input type="number" min={5} required className={inputCls} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </Field>
        <Field label="Places">
          <input type="number" min={1} max={500} required className={inputCls} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </Field>
        <button type="submit" className={btn("primary", "md")} disabled={add.isPending}>
          Ajouter
        </button>
      </form>
      <FormError message={add.error ? errorMessage(add.error) : null} />

      {slots.isLoading ? (
        <Spinner />
      ) : slots.data && slots.data.length > 0 ? (
        <ul className="mt-5 divide-y divide-nuit/10">
          {slots.data.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
              <span>
                <span className="font-semibold">{fmtDateTime(s.starts_at)}</span>
                <span className="ml-2 text-sm text-muted">
                  {s.booked_count} / {s.capacity} réservé{s.booked_count > 1 ? "s" : ""}
                </span>
              </span>
              <button type="button" aria-label="Supprimer le créneau" className={btn("ghost", "sm")} disabled={remove.isPending} onClick={() => remove.mutate(s)}>
                <Icon name="trash" size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-muted">Aucun créneau : les clients ne pourront pas réserver tant que tu n'en ajoutes pas.</p>
      )}
    </section>
  );
}
