import { OFFER_TYPES } from "../../offers/offerTypes";
import type { Offer } from "../../types";

type ArtOffer = Pick<Offer, "id" | "offer_type" | "title" | "image">;

/**
 * Visuel d'une offre : la photo si elle existe, sinon une illustration générée par type.
 * Le même cadre (ratio fixe, fond teinté) sert pour un objet, un service, une séance ou un fichier.
 */
export function OfferArt({
  offer,
  className = "",
  decorative = false,
}: {
  offer: ArtOffer;
  className?: string;
  decorative?: boolean;
}) {
  if (offer.image) {
    return (
      <img
        src={offer.image}
        alt={decorative ? "" : offer.title}
        loading="lazy"
        decoding="async"
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  const { bg, solid, mid } = OFFER_TYPES[offer.offer_type].art;
  const v = offer.id % 5; // petite variation pour que deux offres du même type ne soient pas identiques
  const a11y = decorative ? { "aria-hidden": true } : { role: "img", "aria-label": `Illustration : ${offer.title}` };

  return (
    <svg
      viewBox="0 0 320 240"
      preserveAspectRatio="xMidYMid slice"
      className={`h-full w-full ${className}`}
      {...a11y}
    >
      <rect width="320" height="240" fill={bg} />
      {offer.offer_type === "PHYSICAL_PRODUCT" && (
        <g>
          <circle cx={90 + v * 10} cy="150" r="82" fill={mid} />
          <rect x="130" y="62" width="120" height="120" rx="14" fill={solid} transform={`rotate(${-8 + v * 3} 190 122)`} />
          <rect x="150" y="84" width="80" height="12" rx="6" fill="#fff" opacity=".85" transform={`rotate(${-8 + v * 3} 190 122)`} />
          <rect x="150" y="108" width="50" height="12" rx="6" fill="#fff" opacity=".55" transform={`rotate(${-8 + v * 3} 190 122)`} />
          <circle cx="250" cy="52" r="16" fill="#fff" opacity=".8" />
        </g>
      )}
      {offer.offer_type === "SERVICE" && (
        <g>
          <rect x="52" y="48" width="216" height="150" rx="12" fill="#fff" />
          <rect x="52" y="48" width="216" height="30" rx="12" fill={solid} />
          <circle cx="72" cy="63" r="5" fill="#fff" />
          <circle cx="90" cy="63" r="5" fill="#fff" opacity=".7" />
          <rect x="72" y={96} width={120 + v * 12} height="12" rx="6" fill={mid} />
          <rect x="72" y="120" width="150" height="12" rx="6" fill={mid} opacity=".7" />
          <rect x="72" y="144" width="96" height="12" rx="6" fill={mid} opacity=".45" />
          <path d="M214 140l34 24-15 3 9 17-9 4-9-17-10 11z" fill={solid} stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
        </g>
      )}
      {offer.offer_type === "BOOKING" && (
        <g>
          <rect x="62" y="42" width="196" height="162" rx="14" fill="#fff" />
          <rect x="62" y="42" width="196" height="38" rx="14" fill={solid} />
          <rect x="62" y="64" width="196" height="16" fill={solid} />
          <rect x="102" y="30" width="10" height="26" rx="5" fill="#101b3a" />
          <rect x="208" y="30" width="10" height="26" rx="5" fill="#101b3a" />
          {Array.from({ length: 15 }, (_, i) => {
            const x = 84 + (i % 5) * 34;
            const y = 98 + Math.floor(i / 5) * 32;
            const hit = i === 4 + v;
            return hit ? (
              <rect key={i} x={x - 12} y={y - 10} width="26" height="26" rx="13" fill={solid} />
            ) : (
              <circle key={i} cx={x + 1} cy={y + 3} r="5" fill={mid} />
            );
          })}
        </g>
      )}
      {offer.offer_type === "DIGITAL_PRODUCT" && (
        <g>
          <path d="M92 52h86l36 36v108H92z" fill={mid} transform="rotate(-6 150 120)" />
          <path d="M112 44h86l36 36v116H112z" fill="#fff" />
          <path d="M198 44v36h36z" fill={mid} />
          <rect x="132" y="104" width="82" height="10" rx="5" fill={mid} />
          <rect x="132" y="124" width="60" height="10" rx="5" fill={mid} opacity=".6" />
          <circle cx="172" cy="170" r="22" fill={solid} />
          <path d="M172 158v20m-9-9l9 9 9-9" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx={254 - v * 6} cy="62" r="12" fill="#fff" opacity=".8" />
        </g>
      )}
    </svg>
  );
}
