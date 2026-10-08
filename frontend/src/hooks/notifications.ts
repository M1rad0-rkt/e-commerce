import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import type { NotificationList } from "../types";
import { toDate } from "../utils/format";
import type { IconName } from "../components/ui/Icon";

const KEY = ["notifications"];

/** Interroge le serveur toutes les 20 s tant que l'onglet est visible. */
export function useNotifications(limit = 20) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...KEY, limit],
    queryFn: () => api<NotificationList>("/notifications", { params: { limit } }),
    enabled: !!user,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useNotificationActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });
  const read = useMutation({
    mutationFn: (id: number) => api<void>(`/notifications/${id}/read`, { method: "POST" }),
    onSuccess: refresh,
  });
  const readAll = useMutation({
    mutationFn: () => api<void>("/notifications/read-all", { method: "POST" }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api<void>(`/notifications/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  return { read, readAll, remove };
}

export function notificationIcon(kind: string): IconName {
  if (kind.startsWith("order")) return "bag";
  if (kind.startsWith("booking")) return "calendar";
  if (kind.startsWith("quote")) return "chat";
  if (kind.startsWith("user")) return "user";
  return "bell";
}

const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

export function timeAgo(iso: string): string {
  const seconds = Math.round((toDate(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return "à l'instant";
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  return rtf.format(Math.round(seconds / 86400), "day");
}
