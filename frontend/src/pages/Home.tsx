import { useQuery } from "@tanstack/react-query";
import { useState, type CSSProperties, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { OfferArt } from "../components/offers/OfferArt";
import { OfferCard, OfferCardSkeleton } from "../components/offers/OfferCard";
import { Icon } from "../components/ui/Icon";
import { ErrorState, Seo, Stars, TypeBadge } from "../components/ui/kit";
import { btn, container, inputCls } from "../components/ui/styles";
import { useCategories, useOffers } from "../hooks/queries";
import { OFFER_TYPES, TYPE_ORDER, type OfferType } from "../offers/offerTypes";
import { api } from "../services/api";
import type { Offer, Review } from "../types";
import { discountPercent, money, plural, priceText } from "../utils/format";

/* ---------- Hero ---------- */

const SEARCH_TYPES: { value: OfferType | ""; label: string }[] = [
  { value: "", label: "Tout" },
  ...TYPE_ORDER.map((t) => ({ value: t, label: OFFER_TYPES[t].plural })),
];

function HeroSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [type, setType] = useState<OfferType | "">("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (type) sp.set("type", type);
    navigate(`/explorer${sp.size ? `?${sp}` : ""}`);
  }

  return (
    <form onSubmit={onSubmit} role="search" className="mt-8 max-w-xl">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="hero-q">
          Que cherches-tu ?
        </label>
        <input
          id="hero-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Casque, logo, séance photo…"
          className={`${inputCls} !rounded-full !py-3.5 !pl-5 text-lg`}
        />
        <button type="submit" className={btn("primary", "lg")}>
          <Icon name="search" size={20} /> Chercher
        </button>
      </div>
      <fieldset className="mt-4 flex flex-wrap gap-2">
        <legend className="sr-only">Type d'offre</legend>
        {SEARCH_TYPES.map((t) => (
          <label key={t.value || "all"} className="cursor-pointer">
            <input
              type="radio"
              name="hero-type"
              className="peer sr-only"
              checked={type === t.value}
              onChange={() => setType(t.value)}
            />
            <span className="inline-block rounded-full border-2 border-nuit/25 px-3.5 py-1.5 font-semibold peer-checked:border-nuit peer-checked:bg-nuit peer-checked:text-white peer-focus-visible:outline-3 peer-focus-visible:outline-cobalt">
              {t.label}
            </span>
          </label>
        ))}
      </fieldset>
    </form>
  );
}

/** Fiche réduite du hero : le même cadre pour un objet, un service et une séance. */
function HeroTicket({ offer }: { offer: Offer }) {
  return (
    <div className="ticket-wrap">
      <Link to={`/offers/${offer.slug}`} className="ticket block">
        <div className="relative aspect-[4/3] overflow-hidden rounded-t-[10px]">
          <OfferArt offer={offer} decorative />
          <div className="absolute left-2.5 top-2.5">
            <TypeBadge type={offer.offer_type} solid />
          </div>
        </div>
        <div className="px-3.5 pb-3 pt-3">
          <h3 className="line-clamp-2 min-h-[2.4em] text-lg font-bold leading-tight">{offer.title}</h3>
        </div>
        <div className="ticket-foot flex items-center justify-between gap-2 px-3.5">
          <span className="tnum text-base font-bold">{priceText(offer)}</span>
          <Icon name="right" size={18} />
        </div>
      </Link>
    </div>
  );
}

/** Trois fiches de types différents, posées en désordre : l'unique moment animé de la page. */
function HeroCollage({ offers }: { offers: Offer[] | undefined }) {
  const picks: Offer[] = [];
  for (const t of ["PHYSICAL_PRODUCT", "SERVICE", "BOOKING"] as OfferType[]) {
    const found = offers?.find((o) => o.offer_type === t);
    if (found) picks.push(found);
  }
  const slots = [
    { cls: "mt-10", rot: "-4deg", from: "-14deg", delay: "0.1s" },
    { cls: "mt-0", rot: "2.5deg", from: "10deg", delay: "0.28s" },
    { cls: "mt-14 hidden sm:block", rot: "-2deg", from: "-9deg", delay: "0.46s" },
  ];
  return (
    <div className="flex items-start justify-center gap-3 pb-6 sm:gap-2" aria-label="Exemples d'offres">
      {(picks.length ? picks : [undefined, undefined, undefined]).map((o, i) => (
        <div
          key={o?.id ?? i}
          className={`settle w-40 shrink-0 sm:w-[11.75rem] ${slots[i].cls}`}
          style={{ "--rot": slots[i].rot, "--from": slots[i].from, "--delay": slots[i].delay, transform: `rotate(${slots[i].rot})` } as CSSProperties}
        >
          {o ? <HeroTicket offer={o} /> : <OfferCardSkeleton />}
        </div>
      ))}
    </div>
  );
}

function Hero() {
  const { data } = useOffers({ featured: true, page_size: 12 });
  return (
    <section className="overflow-x-clip">
      <div className={`${container} grid items-center gap-10 py-10 sm:py-16 lg:grid-cols-[1.15fr_1fr]`}>
        <div>
          <h1 className="text-5xl sm:text-7xl">Objets, services, séances et fichiers : un seul comptoir.</h1>
          <p className="mt-6 max-w-xl text-xl text-muted">
            Cherche, compare, puis commande ou réserve. Chaque offre dit clairement ce qui se passe ensuite.
          </p>
          <HeroSearch />
        </div>
        <HeroCollage offers={data?.items} />
      </div>
    </section>
  );
}

/* ---------- Types ---------- */

const TILE_SPAN: Record<OfferType, string> = {
  PHYSICAL_PRODUCT: "col-span-2 md:col-span-4",
  SERVICE: "col-span-1 md:col-span-2",
  BOOKING: "col-span-1 md:col-span-2",
  DIGITAL_PRODUCT: "col-span-2 md:col-span-4",
};

function TypeTiles() {
  const { data } = useOffers({ page_size: 1 });
  const counts = new Map(data?.facets.types.map((t) => [t.value, t.count]));
  return (
    <section className={`${container} py-12`} aria-labelledby="types-title">
      <h2 id="types-title" className="text-3xl sm:text-4xl">
        Que cherches-tu ?
      </h2>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-6">
        {TYPE_ORDER.map((t) => {
          const meta = OFFER_TYPES[t];
          const n = counts.get(t);
          return (
            <Link
              key={t}
              to={`/explorer?type=${t}`}
              className={`group flex min-h-44 flex-col justify-between rounded-2xl p-5 md:min-h-52 ${meta.solid} ${TILE_SPAN[t]}`}
            >
              <Icon name={meta.icon} size={36} />
              <div>
                <h3 className="text-3xl">{meta.plural}</h3>
                <p className="mt-1 max-w-xs text-base opacity-90">{meta.description}</p>
                <p className="tnum mt-3 inline-flex items-center gap-1.5 font-semibold">
                  {n !== undefined ? plural(n, "offre", "offres") : "Voir les offres"}
                  <Icon name="right" size={16} className="transition-transform group-hover:translate-x-1" />
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- Listes ---------- */

function SectionHead({ id, title, to, linkLabel }: { id: string; title: string; to: string; linkLabel: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <h2 id={id} className="text-3xl sm:text-4xl">
        {title}
      </h2>
      <Link to={to} className="shrink-0 font-semibold underline decoration-2 underline-offset-4 hover:text-cobalt">
        {linkLabel}
      </Link>
    </div>
  );
}

function Popular() {
  const { data, isLoading, error, refetch } = useOffers({ sort: "popular", page_size: 8 });
  return (
    <section className="py-12" aria-labelledby="popular-title">
      <div className={container}>
        <SectionHead id="popular-title" title="Offres populaires" to="/explorer?sort=popular" linkLabel="Tout voir" />
      </div>
      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <ul className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-4 sm:scroll-px-6 sm:px-6 lg:scroll-px-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))] lg:px-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))]">
          {(isLoading ? Array.from({ length: 5 }) : data?.items ?? []).map((o, i) => (
            <li key={(o as Offer | undefined)?.id ?? i} className="w-[16.5rem] shrink-0 snap-start sm:w-72">
              {o ? <OfferCard offer={o as Offer} /> : <OfferCardSkeleton />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Spotlight() {
  const { data } = useOffers({ promo: true, page_size: 1, sort: "price_desc" });
  const offer = data?.items[0];
  if (!offer) return null;
  const pct = discountPercent(offer);
  return (
    <section className="my-12 bg-nuit text-white" aria-labelledby="spot-title">
      <div className={`${container} grid items-center gap-8 py-12 md:grid-cols-[1fr_1.1fr] md:py-16`}>
        <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl">
          <div className="aspect-[4/3]">
            <OfferArt offer={offer} decorative />
          </div>
        </div>
        <div>
          <p className="inline-block rounded-full bg-safran px-3 py-1 font-bold text-nuit">
            {pct !== null ? `−${pct} % en ce moment` : "En ce moment"}
          </p>
          <h2 id="spot-title" className="mt-4 text-4xl sm:text-5xl">
            {offer.title}
          </h2>
          <p className="mt-4 max-w-lg text-lg text-white/80">{offer.description}</p>
          <p className="tnum mt-6 flex items-baseline gap-3">
            <span className="text-4xl font-extrabold">{money(offer.price ?? 0, offer.currency)}</span>
            {offer.old_price !== null && (
              <span className="text-xl text-white/70 line-through">{money(offer.old_price, offer.currency)}</span>
            )}
          </p>
          <Link to={`/offers/${offer.slug}`} className={btn("light", "lg", "mt-7")}>
            Voir l'offre <Icon name="right" size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function CategoryIndex() {
  const { data, isLoading } = useCategories();
  const cats = (data ?? []).filter((c) => c.offer_count > 0);
  return (
    <section className={`${container} py-12`} aria-labelledby="cats-title">
      <h2 id="cats-title" className="text-3xl sm:text-4xl">
        Parcourir par catégorie
      </h2>
      <ul className="mt-6 border-b border-nuit/20">
        {isLoading &&
          Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="border-t border-nuit/20 py-4">
              <div className="skeleton h-10 w-2/3 rounded" />
            </li>
          ))}
        {cats.map((c) => (
          <li key={c.id}>
            <Link
              to={`/explorer?category=${c.slug}`}
              className="group flex items-baseline justify-between gap-4 border-t border-nuit/20 px-0 py-3 text-3xl font-bold transition-all hover:bg-nuit hover:px-4 hover:text-white sm:text-5xl"
            >
              <span>{c.name}</span>
              <span className="tnum shrink-0 text-base font-medium opacity-70 sm:text-lg">
                {plural(c.offer_count, "offre", "offres")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Newest() {
  const { data, isLoading, error, refetch } = useOffers({ sort: "newest", page_size: 6 });
  return (
    <section className={`${container} py-12`} aria-labelledby="new-title">
      <SectionHead id="new-title" title="Nouvelles offres" to="/explorer?sort=newest" linkLabel="Tout voir" />
      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(isLoading ? Array.from({ length: 3 }) : data?.items ?? []).map((o, i) => (
            <li key={(o as Offer | undefined)?.id ?? i}>
              {o ? <OfferCard offer={o as Offer} /> : <OfferCardSkeleton />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------- Avantages et avis ---------- */

const PERKS = [
  { icon: "bag" as const, title: "Un seul panier", text: "Un objet, un service et une séance peuvent partir dans la même commande." },
  { icon: "truck" as const, title: "Livraison offerte dès 100 €", text: "Pour les objets en livraison standard. L'express est à 12 €." },
  { icon: "calendar" as const, title: "Réservation confirmée par l'offreur", text: "Ton créneau est bloqué tout de suite, puis validé ou refusé." },
  { icon: "shield" as const, title: "Annulation depuis ton compte", text: "Commandes et réservations s'annulent sans écrire à personne." },
];

function Perks() {
  return (
    <section className={`${container} py-12`} aria-labelledby="perks-title">
      <h2 id="perks-title" className="sr-only">
        Ce que Comptoir garantit
      </h2>
      <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {PERKS.map((p) => (
          <li key={p.title} className="flex gap-4">
            <Icon name={p.icon} size={30} className="mt-0.5 shrink-0 text-cobalt" />
            <div>
              <h3 className="text-lg font-bold leading-snug">{p.title}</h3>
              <p className="mt-1 text-muted">{p.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Reviews() {
  const { data } = useQuery({
    queryKey: ["reviews", "recent"],
    queryFn: () => api<Review[]>("/reviews/recent", { params: { limit: 5 }, auth: false }),
  });
  if (!data?.length) return null;
  const [first, ...rest] = data;
  return (
    <section className={`${container} py-12`} aria-labelledby="reviews-title">
      <h2 id="reviews-title" className="text-3xl sm:text-4xl">
        Ce que disent les clients
      </h2>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <figure className="rounded-2xl bg-cobalt p-7 text-white md:col-span-2 md:row-span-2">
          <blockquote className="text-2xl font-semibold leading-snug sm:text-3xl">« {first.comment} »</blockquote>
          <figcaption className="mt-5 text-white/85">
            {first.user_name} à propos de{" "}
            <Link to={`/offers/${first.offer_slug}`} className="font-semibold underline underline-offset-4">
              {first.offer_title}
            </Link>
          </figcaption>
        </figure>
        {rest.map((r) => (
          <figure key={r.id} className="rounded-2xl bg-white p-5 md:col-span-1">
            <Stars rating={r.rating} count={1} />
            <blockquote className="mt-2 text-base">« {r.comment} »</blockquote>
            <figcaption className="mt-3 text-sm text-muted">
              {r.user_name}, sur{" "}
              <Link to={`/offers/${r.offer_slug}`} className="underline underline-offset-2">
                {r.offer_title}
              </Link>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      <Seo
        title="Produits, services, réservations et fichiers"
        description="Comptoir réunit objets, services, séances à réserver et produits numériques : cherche, compare, commande ou réserve au même endroit."
      />
      <Hero />
      <TypeTiles />
      <Popular />
      <Spotlight />
      <CategoryIndex />
      <Newest />
      <Perks />
      <Reviews />
    </>
  );
}
