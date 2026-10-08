import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { OfferCard, OfferCardSkeleton } from "../components/offers/OfferCard";
import { Icon } from "../components/ui/Icon";
import { EmptyState, ErrorState, Pagination, Seo } from "../components/ui/kit";
import { btn, container, inputCls } from "../components/ui/styles";
import { useOffers } from "../hooks/queries";
import { OFFER_TYPES, TYPE_ORDER, typeFromParam, type OfferType } from "../offers/offerTypes";
import type { OfferPage } from "../types";
import { plural } from "../utils/format";

const SORTS = [
  { value: "relevance", label: "Pertinence" },
  { value: "newest", label: "Nouveautés" },
  { value: "price_asc", label: "Prix croissant" },
  { value: "price_desc", label: "Prix décroissant" },
  { value: "rating", label: "Meilleures notes" },
  { value: "popular", label: "Popularité" },
];

const RATINGS = [
  { value: "", label: "Toutes les notes" },
  { value: "3", label: "3 étoiles et plus" },
  { value: "4", label: "4 étoiles et plus" },
  { value: "4.5", label: "4,5 étoiles et plus" },
];

interface FilterState {
  q: string;
  types: OfferType[];
  category: string;
  minPrice: string;
  maxPrice: string;
  inStock: boolean;
  minRating: string;
  promo: boolean;
  sort: string;
  page: number;
}

function readFilters(sp: URLSearchParams): FilterState {
  return {
    q: sp.get("q") ?? "",
    types: sp.getAll("type").map(typeFromParam).filter((t): t is OfferType => t !== null),
    category: sp.get("category") ?? "",
    minPrice: sp.get("min_price") ?? "",
    maxPrice: sp.get("max_price") ?? "",
    inStock: sp.get("in_stock") === "1",
    minRating: sp.get("min_rating") ?? "",
    promo: sp.get("promo") === "1",
    sort: SORTS.some((s) => s.value === sp.get("sort")) ? (sp.get("sort") as string) : "relevance",
    page: Math.max(1, Number(sp.get("page")) || 1),
  };
}

function FilterPanel({
  f,
  facets,
  update,
  onReset,
}: {
  f: FilterState;
  facets: OfferPage["facets"] | undefined;
  update: (changes: Record<string, string | string[] | null>) => void;
  onReset: () => void;
}) {
  const [min, setMin] = useState(f.minPrice);
  const [max, setMax] = useState(f.maxPrice);
  useEffect(() => {
    setMin(f.minPrice);
    setMax(f.maxPrice);
  }, [f.minPrice, f.maxPrice]);

  const typeCounts = new Map(facets?.types.map((t) => [t.value, t.count]));

  function applyPrice(e: FormEvent) {
    e.preventDefault();
    update({ min_price: min || null, max_price: max || null });
  }

  const group = "border-t border-nuit/15 py-5";
  const legend = "mb-3 text-lg font-bold";

  return (
    <div>
      <fieldset className="pb-5">
        <legend className={legend}>Type d'offre</legend>
        <div className="space-y-2.5">
          {TYPE_ORDER.map((t) => {
            const checked = f.types.includes(t);
            return (
              <label key={t} className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-cobalt"
                  checked={checked}
                  onChange={() => update({ type: checked ? f.types.filter((x) => x !== t) : [...f.types, t] })}
                />
                <span className="flex-1">{OFFER_TYPES[t].plural}</span>
                <span className="tnum text-sm text-muted">{typeCounts.get(t) ?? 0}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className={group}>
        <legend className={legend}>Catégorie</legend>
        <div className="space-y-2.5">
          <label className="flex cursor-pointer items-center gap-3">
            <input type="radio" name="cat" className="h-5 w-5 accent-cobalt" checked={!f.category} onChange={() => update({ category: null })} />
            <span>Toutes</span>
          </label>
          {facets?.categories.map((c) => (
            <label key={c.value} className="flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="cat"
                className="h-5 w-5 accent-cobalt"
                checked={f.category === c.value}
                onChange={() => update({ category: c.value })}
              />
              <span className="flex-1">{c.label}</span>
              <span className="tnum text-sm text-muted">{c.count}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <form onSubmit={applyPrice} className={group}>
        <p className={legend} id="price-label">
          Prix
        </p>
        <div className="flex items-center gap-2" role="group" aria-labelledby="price-label">
          <input
            type="number"
            min={0}
            inputMode="decimal"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            placeholder={facets?.price_min != null ? String(Math.floor(facets.price_min)) : "Min"}
            aria-label="Prix minimum"
            className={inputCls}
          />
          <span aria-hidden="true">–</span>
          <input
            type="number"
            min={0}
            inputMode="decimal"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            placeholder={facets?.price_max != null ? String(Math.ceil(facets.price_max)) : "Max"}
            aria-label="Prix maximum"
            className={inputCls}
          />
        </div>
        <button type="submit" className={btn("secondary", "sm", "mt-3")}>
          Appliquer
        </button>
      </form>

      <div className={`${group} space-y-4`}>
        <label className="flex cursor-pointer items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-cobalt" checked={f.inStock} onChange={(e) => update({ in_stock: e.target.checked ? "1" : null })} />
          <span>Disponible maintenant</span>
        </label>
        <label className="flex cursor-pointer items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-cobalt" checked={f.promo} onChange={(e) => update({ promo: e.target.checked ? "1" : null })} />
          <span>En promotion</span>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Note</span>
          <select className={inputCls} value={f.minRating} onChange={(e) => update({ min_rating: e.target.value || null })}>
            {RATINGS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button type="button" onClick={onReset} className={btn("ghost", "sm", "mt-1 underline")}>
        Réinitialiser les filtres
      </button>
    </div>
  );
}

export default function ExplorePage() {
  const [sp, setSp] = useSearchParams();
  const f = readFilters(sp);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState(f.q);

  useEffect(() => setSearch(f.q), [f.q]);

  function update(changes: Record<string, string | string[] | null>) {
    setSp(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          next.delete(key);
          if (Array.isArray(value)) value.forEach((v) => next.append(key, v));
          else if (value) next.set(key, value);
        }
        if (!("page" in changes)) next.delete("page");
        return next;
      },
      { replace: true },
    );
  }

  // Recherche saisie : appliquée après une courte pause pour ne pas lancer une requête par lettre.
  useEffect(() => {
    if (search.trim() === f.q) return;
    const id = window.setTimeout(() => update({ q: search.trim() || null }), 400);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const params = {
    q: f.q,
    type: f.types,
    category: f.category,
    min_price: f.minPrice,
    max_price: f.maxPrice,
    in_stock: f.inStock,
    min_rating: f.minRating,
    promo: f.promo,
    sort: f.sort,
    page: f.page,
    page_size: 12,
  };
  const { data, isLoading, isFetching, error, refetch } = useOffers(params, { keepPrevious: true });

  const activeCount =
    f.types.length + (f.category ? 1 : 0) + (f.minPrice || f.maxPrice ? 1 : 0) + (f.inStock ? 1 : 0) + (f.minRating ? 1 : 0) + (f.promo ? 1 : 0);
  const resetAll = () => setSp(new URLSearchParams(f.q ? { q: f.q } : {}), { replace: true });

  const categoryLabel = data?.facets.categories.find((c) => c.value === f.category)?.label;
  const title = categoryLabel ?? (f.types.length === 1 ? OFFER_TYPES[f.types[0]].plural : "Explorer les offres");

  const chips: { label: string; remove: () => void }[] = [
    ...f.types.map((t) => ({ label: OFFER_TYPES[t].plural, remove: () => update({ type: f.types.filter((x) => x !== t) }) })),
    ...(f.category ? [{ label: categoryLabel ?? f.category, remove: () => update({ category: null }) }] : []),
    ...(f.minPrice || f.maxPrice
      ? [{ label: `Prix : ${f.minPrice || "0"} à ${f.maxPrice || "∞"}`, remove: () => update({ min_price: null, max_price: null }) }]
      : []),
    ...(f.inStock ? [{ label: "Disponible", remove: () => update({ in_stock: null }) }] : []),
    ...(f.promo ? [{ label: "En promotion", remove: () => update({ promo: null }) }] : []),
    ...(f.minRating ? [{ label: `Note ${f.minRating}+`, remove: () => update({ min_rating: null }) }] : []),
  ];

  return (
    <div className={`${container} py-8 sm:py-12`}>
      <Seo
        title={title}
        description="Parcours toutes les offres de Comptoir : filtre par type, catégorie, prix, disponibilité et note."
      />
      <h1 className="text-4xl sm:text-5xl">{title}</h1>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <form role="search" className="relative flex-1" onSubmit={(e) => (e.preventDefault(), update({ q: search.trim() || null }))}>
          <label className="sr-only" htmlFor="explore-q">
            Rechercher par nom, description ou catégorie
          </label>
          <Icon name="search" size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="explore-q"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, description ou catégorie"
            className={`${inputCls} !rounded-full !pl-12`}
          />
        </form>
        <div className="flex gap-3">
          <button type="button" className={btn("secondary", "md", "flex-1 lg:hidden")} onClick={() => dialogRef.current?.showModal()}>
            <Icon name="filter" size={18} /> Filtres{activeCount > 0 && ` (${activeCount})`}
          </button>
          <label className="flex-1 sm:flex-none">
            <span className="sr-only">Trier par</span>
            <select className={`${inputCls} !rounded-full`} value={f.sort} onChange={(e) => update({ sort: e.target.value === "relevance" ? null : e.target.value })}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  Trier : {s.label.toLowerCase()}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[17rem_1fr]">
        <aside className="hidden lg:block" aria-label="Filtres">
          <FilterPanel f={f} facets={data?.facets} update={update} onReset={resetAll} />
        </aside>

        <section aria-live="polite" aria-busy={isFetching}>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <p className="tnum mr-2 font-semibold" role="status">
              {data ? plural(data.total, "offre", "offres") : "Chargement…"}
            </p>
            {chips.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={c.remove}
                className="inline-flex items-center gap-1.5 rounded-full bg-nuit/10 px-3 py-1 text-sm font-semibold hover:bg-nuit/20"
                aria-label={`Retirer le filtre ${c.label}`}
              >
                {c.label} <Icon name="close" size={14} />
              </button>
            ))}
          </div>

          {error ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : isLoading ? (
            <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i}>
                  <OfferCardSkeleton />
                </li>
              ))}
            </ul>
          ) : data && data.items.length === 0 ? (
            <EmptyState title="Aucune offre ne correspond">
              Essaie avec moins de filtres ou un autre mot.
              <span className="mt-5 flex justify-center gap-3">
                <button type="button" onClick={resetAll} className={btn("primary")}>
                  Réinitialiser
                </button>
                <Link to="/" className={btn("secondary")}>
                  Accueil
                </Link>
              </span>
            </EmptyState>
          ) : (
            <>
              <ul className={`grid gap-5 sm:grid-cols-2 xl:grid-cols-3 ${isFetching ? "opacity-70" : ""}`}>
                {data?.items.map((o) => (
                  <li key={o.id}>
                    <OfferCard offer={o} />
                  </li>
                ))}
              </ul>
              <Pagination
                page={data?.page ?? 1}
                pages={data?.pages ?? 1}
                onChange={(p) => {
                  update({ page: p > 1 ? String(p) : null });
                  window.scrollTo({ top: 0 });
                }}
              />
            </>
          )}
        </section>
      </div>

      <dialog ref={dialogRef} className="drawer" aria-label="Filtres" onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}>
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-nuit/15 px-5 py-4">
            <h2 className="text-2xl">Filtres</h2>
            <button type="button" onClick={() => dialogRef.current?.close()} className="grid h-10 w-10 place-items-center rounded-full hover:bg-nuit/10" aria-label="Fermer les filtres">
              <Icon name="close" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <FilterPanel f={f} facets={data?.facets} update={update} onReset={resetAll} />
          </div>
          <div className="border-t border-nuit/15 p-4">
            <button type="button" className={btn("primary", "lg", "w-full")} onClick={() => dialogRef.current?.close()}>
              Voir {data ? plural(data.total, "offre", "offres") : "les offres"}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
