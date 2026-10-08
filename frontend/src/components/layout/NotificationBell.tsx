import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useToast } from "../../context/ToastContext";
import { notificationIcon, timeAgo, useNotificationActions, useNotifications } from "../../hooks/notifications";
import type { AppNotification } from "../../types";
import { Icon } from "../ui/Icon";

export function NotificationItem({
  n,
  onOpen,
}: {
  n: AppNotification;
  onOpen: (n: AppNotification) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-nuit/5 ${n.is_read ? "" : "bg-cobalt/5"}`}
    >
      <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${n.is_read ? "bg-nuit/10" : "bg-cobalt text-white"}`}>
        <Icon name={notificationIcon(n.kind)} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block ${n.is_read ? "font-medium" : "font-bold"}`}>{n.title}</span>
        {n.body && <span className="block truncate text-sm text-muted">{n.body}</span>}
        <span className="mt-0.5 block text-xs text-muted">{timeAgo(n.created_at)}</span>
      </span>
      {!n.is_read && <span aria-label="Non lue" className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-corail" />}
    </button>
  );
}

export default function NotificationBell() {
  const { data } = useNotifications(10);
  const { read, readAll } = useNotificationActions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const lastSeen = useRef<number | null>(null);

  // Une alerte s'affiche quand une notification plus récente que la dernière connue arrive.
  useEffect(() => {
    if (!data) return;
    const newest = data.items[0]?.id ?? 0;
    if (lastSeen.current !== null && newest > lastSeen.current) {
      const fresh = data.items.filter((n) => n.id > (lastSeen.current ?? 0) && !n.is_read);
      if (fresh.length === 1) toast.push(fresh[0].title);
      else if (fresh.length > 1) toast.push(`${fresh.length} nouvelles notifications`);
      // Les écrans concernés (tableau de bord, commandes, réservations, devis) se remettent à jour.
      for (const key of ["admin", "orders", "bookings", "quotes"]) queryClient.invalidateQueries({ queryKey: [key] });
    }
    lastSeen.current = Math.max(lastSeen.current ?? 0, newest);
  }, [data, toast, queryClient]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = data?.unread ?? 0;

  function openItem(n: AppNotification) {
    if (!n.is_read) read.mutate(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label={unread ? `Notifications, ${unread} non lue${unread > 1 ? "s" : ""}` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-11 w-11 place-items-center rounded-full hover:bg-nuit/10"
      >
        <Icon name="bell" />
        {unread > 0 && (
          <span className="tnum absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-corail px-1 text-xs font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="region"
          aria-label="Notifications"
          className="fixed inset-x-2 top-16 z-50 max-h-[75vh] overflow-hidden rounded-2xl border border-nuit/15 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[24rem]"
        >
          <div className="flex items-center justify-between border-b border-nuit/10 px-4 py-3">
            <h2 className="text-lg font-bold">Notifications</h2>
            <button
              type="button"
              className="text-sm font-semibold text-cobalt underline-offset-4 hover:underline disabled:text-muted disabled:no-underline"
              disabled={unread === 0 || readAll.isPending}
              onClick={() => readAll.mutate()}
            >
              Tout marquer comme lu
            </button>
          </div>
          <div className="max-h-[55vh] divide-y divide-nuit/10 overflow-y-auto">
            {data && data.items.length > 0 ? (
              data.items.map((n) => <NotificationItem key={n.id} n={n} onOpen={openItem} />)
            ) : (
              <p className="px-4 py-10 text-center text-muted">Rien de nouveau pour le moment.</p>
            )}
          </div>
          <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-nuit/10 px-4 py-3 text-center font-semibold hover:bg-nuit/5">
            Voir toutes les notifications
          </Link>
        </div>
      )}
    </div>
  );
}
