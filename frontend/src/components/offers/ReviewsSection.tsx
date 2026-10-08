import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { api } from "../../services/api";
import type { Offer, Paged, Review } from "../../types";
import { errorMessage, fmtDate } from "../../utils/format";
import { Icon } from "../ui/Icon";
import { FormError, Pagination, Stars, StarPicker } from "../ui/kit";
import { btn, inputCls } from "../ui/styles";

export function ReviewsSection({ offer }: { offer: Offer }) {
  const { user } = useAuth();
  const location = useLocation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["reviews", offer.id, page],
    queryFn: () => api<Paged<Review>>(`/offers/${offer.id}/reviews`, { params: { page, page_size: 5 }, auth: false }),
  });

  const submit = useMutation({
    mutationFn: () => api<Review>(`/offers/${offer.id}/reviews`, { method: "POST", body: { rating, comment: comment.trim() } }),
    onSuccess: () => {
      toast.push("Merci, ton avis est publié.");
      setComment("");
      setRating(0);
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      queryClient.invalidateQueries({ queryKey: ["offer", offer.slug] });
    },
  });

  return (
    <section aria-labelledby="reviews-title" className="mt-14">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="reviews-title" className="text-3xl">
          Avis
        </h2>
        <Stars rating={offer.rating_avg} count={offer.rating_count} className="!text-lg" />
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          {isLoading ? (
            <div className="skeleton h-28 rounded-xl" />
          ) : data && data.items.length > 0 ? (
            <>
              <ul className="space-y-4">
                {data.items.map((r) => (
                  <li key={r.id} className="rounded-xl bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold">{r.user_name}</p>
                      <time className="text-sm text-muted" dateTime={r.created_at}>
                        {fmtDate(r.created_at)}
                      </time>
                    </div>
                    <p className="mt-1 flex" aria-label={`Note : ${r.rating} sur 5`}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <Icon key={i} name="star" size={18} className={i < r.rating ? "text-safran" : "text-nuit/20"} />
                      ))}
                    </p>
                    {r.comment && <p className="mt-2">{r.comment}</p>}
                  </li>
                ))}
              </ul>
              <Pagination page={data.page} pages={data.pages} onChange={setPage} />
            </>
          ) : (
            <p className="text-muted">Aucun avis pour l'instant. Sois le premier à donner le tien.</p>
          )}
        </div>

        <div className="h-fit rounded-2xl bg-white p-5">
          <h3 className="text-xl font-bold">Donner mon avis</h3>
          {user ? (
            <form
              className="mt-3 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (rating) submit.mutate();
              }}
            >
              <StarPicker value={rating} onChange={setRating} />
              <label className="block">
                <span className="sr-only">Commentaire</span>
                <textarea rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} className={inputCls} placeholder="Ce qui t'a plu ou non (facultatif)" />
              </label>
              <FormError message={submit.error ? errorMessage(submit.error) : null} />
              <button type="submit" disabled={!rating || submit.isPending} className={btn("primary", "md", "w-full")}>
                {submit.isPending ? "Envoi…" : rating ? "Publier mon avis" : "Choisis une note"}
              </button>
              <p className="text-sm text-muted">Un seul avis par offre : un nouvel envoi remplace le précédent.</p>
            </form>
          ) : (
            <p className="mt-3">
              <Link to={`/connexion?next=${encodeURIComponent(location.pathname)}`} className={btn("secondary")}>
                Connecte-toi pour donner ton avis
              </Link>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
