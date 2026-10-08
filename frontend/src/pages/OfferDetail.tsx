import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { FavoriteButton } from "../components/offers/FavoriteButton";
import { OfferArt } from "../components/offers/OfferArt";
import { ReviewsSection } from "../components/offers/ReviewsSection";
import { EmptyState, ErrorState, Seo, Skeleton, Stars, TypeBadge } from "../components/ui/kit";
import { container } from "../components/ui/styles";
import { PANELS, QuotePanel } from "../offers/panels";
import { ApiError, api } from "../services/api";
import type { Offer } from "../types";
import { discountPercent, money, priceText } from "../utils/format";

function DetailSkeleton() {
  return (
    <div className={`${container} grid gap-10 py-10 lg:grid-cols-2`} aria-hidden="true">
      <Skeleton className="aspect-[4/3] w-full" />
      <div className="space-y-4">
        <Skeleton className="h-6 w-1/4" />
        <Skeleton className="h-12 w-4/5" />
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

export default function OfferDetailPage() {
  const { slug = "" } = useParams();
  const { data: offer, isLoading, error, refetch } = useQuery({
    queryKey: ["offer", slug],
    queryFn: () => api<Offer>(`/offers/${encodeURIComponent(slug)}`, { auth: false }),
    retry: (count, e) => !(e instanceof ApiError && e.status === 404) && count < 1,
  });

  if (isLoading) return <DetailSkeleton />;
  if (error instanceof ApiError && error.status === 404)
    return (
      <EmptyState title="Cette offre n'existe plus" action={{ to: "/explorer", label: "Voir les autres offres" }}>
        Elle a peut-être été retirée ou son adresse a changé.
      </EmptyState>
    );
  if (error || !offer) return <ErrorState error={error} onRetry={() => refetch()} />;

  const quote = offer.price_mode === "QUOTE";
  const Panel = quote ? QuotePanel : PANELS[offer.offer_type];
  const discount = discountPercent(offer);
  const gallery = offer.gallery.length ? offer.gallery : [];

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": offer.offer_type === "PHYSICAL_PRODUCT" || offer.offer_type === "DIGITAL_PRODUCT" ? "Product" : "Service",
    name: offer.title,
    description: offer.description,
    ...(offer.image ? { image: offer.image } : {}),
    ...(offer.category ? { category: offer.category.name } : {}),
    ...(offer.rating_count > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: offer.rating_avg, reviewCount: offer.rating_count } }
      : {}),
    ...(offer.price !== null
      ? { offers: { "@type": "Offer", price: offer.price, priceCurrency: offer.currency, availability: offer.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" } }
      : {}),
  };

  return (
    <article className={`${container} py-8 sm:py-12`}>
      <Seo title={offer.title} description={offer.description.slice(0, 155)} jsonLd={jsonLd} />

      <nav aria-label="Fil d'Ariane" className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-muted">
        <Link to="/explorer" className="hover:underline">
          Explorer
        </Link>
        {offer.category && (
          <>
            <span aria-hidden="true">/</span>
            <Link to={`/explorer?category=${offer.category.slug}`} className="hover:underline">
              {offer.category.name}
            </Link>
          </>
        )}
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="font-semibold text-nuit">
          {offer.title}
        </span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
            <OfferArt offer={offer} />
            <FavoriteButton offerId={offer.id} title={offer.title} className="absolute right-4 top-4" />
          </div>
          {gallery.length > 0 && (
            <ul className="mt-3 grid grid-cols-4 gap-2">
              {gallery.slice(0, 4).map((src) => (
                <li key={src} className="aspect-square overflow-hidden rounded-lg">
                  <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <TypeBadge type={offer.offer_type} />
            <Stars rating={offer.rating_avg} count={offer.rating_count} />
          </div>
          <h1 className="mt-3 text-4xl sm:text-5xl">{offer.title}</h1>

          <p className="tnum mt-4 flex flex-wrap items-baseline gap-x-3">
            <span className="price text-4xl font-extrabold">{priceText(offer)}</span>
            {offer.old_price !== null && discount !== null && (
              <>
                <span className="text-xl text-muted line-through">{money(offer.old_price, offer.currency)}</span>
                <span className="rounded-full bg-safran px-2.5 py-0.5 text-base font-bold">−{discount} %</span>
              </>
            )}
          </p>

          <p className="mt-5 max-w-prose text-lg">{offer.description}</p>

          <div className="mt-8">
            <Panel offer={offer} />
          </div>
        </div>
      </div>

      <ReviewsSection offer={offer} />
    </article>
  );
}
