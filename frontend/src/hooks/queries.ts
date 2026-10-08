import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import type { Category, OfferPage } from "../types";

export type OfferParams = Record<string, string | number | boolean | (string | number)[] | null | undefined>;

export function useOffers(params: OfferParams, options: { keepPrevious?: boolean } = {}) {
  return useQuery({
    queryKey: ["offers", params],
    queryFn: () => api<OfferPage>("/offers", { params, auth: false }),
    placeholderData: options.keepPrevious ? keepPreviousData : undefined,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => api<Category[]>("/categories", { auth: false }),
    staleTime: 5 * 60_000,
  });
}

export function useFavoriteIds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["favorites", "ids"],
    queryFn: () => api<number[]>("/favorites/ids"),
    enabled: !!user,
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ offerId, on }: { offerId: number; on: boolean }) =>
      api<void>(`/favorites/${offerId}`, { method: on ? "POST" : "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorites"] }),
  });
}
