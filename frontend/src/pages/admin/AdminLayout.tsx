import { useQuery } from "@tanstack/react-query";
import { Link, NavLink, Outlet } from "react-router-dom";

import { Icon, type IconName } from "../../components/ui/Icon";
import { ErrorState, Seo, Spinner } from "../../components/ui/kit";
import { btn, container } from "../../components/ui/styles";
import { api } from "../../services/api";
import type { AdminStats } from "../../types";
import { money } from "../../utils/format";

const LINKS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: "/admin", label: "Tableau de bord", icon: "grid", end: true },
  { to: "/admin/offres", label: "Offres", icon: "tag" },
  { to: "/admin/categories", label: "Catégories", icon: "filter" },
  { to: "/admin/commandes", label: "Commandes", icon: "bag" },
  { to: "/admin/reservations", label: "Réservations", icon: "calendar" },
  { to: "/admin/devis", label: "Devis", icon: "chat" },
  { to: "/admin/utilisateurs", label: "Utilisateurs", icon: "user" },
];

export default function AdminLayout() {
  return (
    <div className={`${container} py-8 sm:py-12`}>
      <Seo title="Administration" />
      <p className="text-sm font-bold uppercase tracking-wide text-muted">Administration</p>
      <div className="mt-4 grid gap-8 lg:grid-cols-[15rem_1fr]">
        <nav aria-label="Administration" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
          <ul className="flex gap-2 lg:flex-col lg:gap-1">
            {LINKS.map((l) => (
              <li key={l.to} className="shrink-0">
                <NavLink
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 whitespace-nowrap rounded-full px-4 py-2.5 font-semibold lg:rounded-xl ${
                      isActive ? "bg-nuit text-white" : "hover:bg-nuit/10"
                    }`
                  }
                >
                  <Icon name={l.icon} size={18} />
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  to,
  alert = false,
  sub,
}: {
  label: string;
  value: string;
  to: string;
  alert?: boolean;
  sub?: string;
}) {
  return (
    <Link
      to={to}
      className={`block rounded-2xl p-5 transition-colors ${alert ? "bg-safran hover:bg-safran/80" : "bg-white hover:bg-white/70"}`}
    >
      <p className="text-sm font-semibold text-nuit/70">{label}</p>
      <p className="tnum mt-1 text-4xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-sm text-nuit/70">{sub}</p>}
    </Link>
  );
}

export function AdminDashboard() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => api<AdminStats>("/admin/stats"),
  });

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  const todo = data.orders.pending + data.bookings_pending + data.quotes_new;

  return (
    <>
      <Seo title="Tableau de bord" />
      <h1 className="text-4xl sm:text-5xl">Tableau de bord</h1>
      <p className="mt-3 text-lg text-muted">
        {todo === 0
          ? "Rien en attente : tout est à jour."
          : `${todo} élément${todo > 1 ? "s" : ""} attend${todo > 1 ? "ent" : ""} ta réponse.`}
      </p>

      <h2 className="mt-8 text-2xl">À traiter</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Tile label="Commandes en attente" value={String(data.orders.pending)} to="/admin/commandes" alert={data.orders.pending > 0} />
        <Tile label="Réservations à confirmer" value={String(data.bookings_pending)} to="/admin/reservations" alert={data.bookings_pending > 0} />
        <Tile label="Nouveaux devis" value={String(data.quotes_new)} to="/admin/devis" alert={data.quotes_new > 0} />
      </div>

      <h2 className="mt-8 text-2xl">Activité</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Chiffre d'affaires" value={money(data.orders.revenue)} to="/admin/commandes" sub="Commandes réglées, hors annulées" />
        <Tile label="Commandes" value={String(data.orders.total)} to="/admin/commandes" />
        <Tile
          label="Offres publiées"
          value={`${data.offers.published} / ${data.offers.total}`}
          to="/admin/offres"
          sub={data.offers.total > data.offers.published ? "Le reste est en brouillon" : undefined}
        />
        <Tile label="Utilisateurs" value={String(data.users)} to="/admin/utilisateurs" />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/admin/offres/nouvelle" className={btn("primary", "lg")}>
          <Icon name="plus" size={18} /> Nouvelle offre
        </Link>
        <Link to="/" className={btn("secondary", "lg")}>
          Voir la boutique
        </Link>
      </div>
    </>
  );
}
