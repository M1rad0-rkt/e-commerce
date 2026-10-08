import { useNavigate } from "react-router-dom";

import { NotificationItem } from "../components/layout/NotificationBell";
import { EmptyState, ErrorState, Seo, Spinner } from "../components/ui/kit";
import { btn, container } from "../components/ui/styles";
import { Icon } from "../components/ui/Icon";
import { useNotificationActions, useNotifications } from "../hooks/notifications";
import type { AppNotification } from "../types";

export default function NotificationsPage() {
  const { data, isLoading, error, refetch } = useNotifications(100);
  const { read, readAll, remove } = useNotificationActions();
  const navigate = useNavigate();

  function open(n: AppNotification) {
    if (!n.is_read) read.mutate(n.id);
    if (n.link) navigate(n.link);
  }

  return (
    <div className={`${container} max-w-3xl py-8 sm:py-12`}>
      <Seo title="Notifications" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-4xl sm:text-5xl">Notifications</h1>
        <button
          type="button"
          className={btn("secondary", "md")}
          disabled={!data || data.unread === 0 || readAll.isPending}
          onClick={() => readAll.mutate()}
        >
          Tout marquer comme lu
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState title="Rien de nouveau">Les changements sur tes commandes, réservations et devis apparaîtront ici.</EmptyState>
      ) : (
        <ul className="mt-8 divide-y divide-nuit/10 overflow-hidden rounded-2xl bg-white">
          {data.items.map((n) => (
            <li key={n.id} className="flex items-stretch">
              <div className="min-w-0 flex-1">
                <NotificationItem n={n} onOpen={open} />
              </div>
              <button
                type="button"
                aria-label={`Supprimer la notification : ${n.title}`}
                className="px-4 text-muted hover:text-corail"
                onClick={() => remove.mutate(n.id)}
              >
                <Icon name="trash" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
