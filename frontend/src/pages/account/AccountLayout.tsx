import { NavLink, Outlet } from "react-router-dom";

import { Icon, type IconName } from "../../components/ui/Icon";
import { Seo } from "../../components/ui/kit";
import { container } from "../../components/ui/styles";
import { useAuth } from "../../context/AuthContext";

const LINKS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: "/compte", label: "Profil", icon: "user", end: true },
  { to: "/compte/commandes", label: "Commandes", icon: "bag" },
  { to: "/compte/services", label: "Services commandés", icon: "pencil" },
  { to: "/compte/reservations", label: "Réservations", icon: "calendar" },
  { to: "/compte/devis", label: "Demandes de devis", icon: "chat" },
  { to: "/compte/favoris", label: "Favoris", icon: "heart" },
  { to: "/compte/avis", label: "Mes avis", icon: "star" },
  { to: "/compte/adresses", label: "Adresses", icon: "pin" },
  { to: "/compte/parametres", label: "Paramètres", icon: "settings" },
];

export default function AccountLayout() {
  const { user } = useAuth();
  return (
    <div className={`${container} py-8 sm:py-12`}>
      <Seo title="Mon compte" />
      <h1 className="text-4xl sm:text-5xl">Bonjour {user?.full_name.split(" ")[0]}</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[15rem_1fr]">
        <nav aria-label="Espace personnel" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
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
