import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useCategories } from "../../hooks/queries";
import { Icon, type IconName } from "../ui/Icon";
import NotificationBell from "./NotificationBell";
import { container } from "../ui/styles";

function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="Comptoir, retour à l'accueil">
      <svg width="30" height="22" viewBox="0 0 30 22" aria-hidden="true">
        <path
          d="M3 1h24a2 2 0 012 2v5a3 3 0 000 6v5a2 2 0 01-2 2H3a2 2 0 01-2-2v-5a3 3 0 000-6V3a2 2 0 012-2z"
          fill={light ? "#fff" : "#2b4bff"}
        />
        <path d="M10 5v12" stroke={light ? "#101b3a" : "#fff"} strokeWidth="2" strokeDasharray="2 2.5" />
      </svg>
      <span className={`text-2xl font-extrabold tracking-tight ${light ? "text-white" : "text-nuit"}`}>Comptoir</span>
    </Link>
  );
}

const navCls = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3.5 py-2 font-semibold hover:bg-nuit/10 ${isActive ? "bg-nuit/10" : ""}`;

function CategoryMenu() {
  const { data } = useCategories();
  const ref = useRef<HTMLDetailsElement>(null);
  const location = useLocation();

  useEffect(() => {
    ref.current?.removeAttribute("open");
  }, [location.pathname, location.search]);

  return (
    <details
      ref={ref}
      className="relative"
      onKeyDown={(e) => e.key === "Escape" && ref.current?.removeAttribute("open")}
    >
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full px-3.5 py-2 font-semibold hover:bg-nuit/10 [&::-webkit-details-marker]:hidden">
        Catégories <Icon name="down" size={16} />
      </summary>
      <ul className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl bg-white p-2 shadow-xl ring-1 ring-nuit/10">
        {(data ?? []).map((c) => (
          <li key={c.id}>
            <Link
              to={`/explorer?category=${c.slug}`}
              className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-brume"
            >
              {c.name}
              <span className="tnum text-sm text-muted">{c.offer_count}</span>
            </Link>
          </li>
        ))}
        {data?.length === 0 && <li className="px-3 py-2 text-muted">Aucune catégorie pour l'instant.</li>}
      </ul>
    </details>
  );
}

function Header() {
  const { user, isAdmin } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  function onSearch(e: FormEvent) {
    e.preventDefault();
    navigate(q.trim() ? `/explorer?q=${encodeURIComponent(q.trim())}` : "/explorer");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-nuit/10 bg-brume/95 backdrop-blur">
      <div className={`${container} flex items-center gap-3 py-3`}>
        <Logo />
        <nav aria-label="Navigation principale" className="ml-4 hidden items-center lg:flex">
          <NavLink to="/" end className={navCls}>
            Accueil
          </NavLink>
          <NavLink to="/explorer" end className={navCls}>
            Explorer
          </NavLink>
          <CategoryMenu />
          <Link to="/explorer?type=PHYSICAL_PRODUCT" className="rounded-full px-3.5 py-2 font-semibold hover:bg-nuit/10">
            Produits
          </Link>
          <Link to="/explorer?type=SERVICE" className="rounded-full px-3.5 py-2 font-semibold hover:bg-nuit/10">
            Services
          </Link>
        </nav>

        <form onSubmit={onSearch} role="search" className="ml-auto hidden w-full max-w-xs items-center md:flex">
          <label className="sr-only" htmlFor="header-search">
            Rechercher une offre
          </label>
          <div className="relative w-full">
            <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="header-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher une offre"
              className="w-full rounded-full border border-nuit/25 bg-white py-2 pl-10 pr-4 focus-visible:border-cobalt"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Link to="/explorer" className="grid h-11 w-11 place-items-center rounded-full hover:bg-nuit/10 md:hidden" aria-label="Rechercher">
            <Icon name="search" />
          </Link>
          <Link to="/compte/favoris" className="hidden h-11 w-11 place-items-center rounded-full hover:bg-nuit/10 sm:grid" aria-label="Mes favoris">
            <Icon name="heart" />
          </Link>
          {isAdmin && (
            <Link to="/admin" className="hidden rounded-full bg-safran px-3.5 py-2 text-sm font-bold text-nuit hover:bg-safran/80 lg:inline-block">
              Administration
            </Link>
          )}
          {user && <NotificationBell />}
          {user ? (
            <Link to="/compte" className="hidden h-11 items-center gap-2 rounded-full px-3 hover:bg-nuit/10 sm:flex" aria-label="Mon compte">
              <Icon name="user" />
              <span className="hidden max-w-28 truncate font-semibold xl:inline">{user.full_name.split(" ")[0]}</span>
            </Link>
          ) : (
            <Link to="/connexion" className="hidden rounded-full px-3.5 py-2 font-semibold hover:bg-nuit/10 sm:inline-block">
              Connexion
            </Link>
          )}
          <Link to="/panier" className="relative grid h-11 w-11 place-items-center rounded-full hover:bg-nuit/10" aria-label={`Panier, ${count} article${count > 1 ? "s" : ""}`}>
            <Icon name="bag" />
            {count > 0 && (
              <span className="tnum absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-corail px-1 text-xs font-bold text-white">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

function MobileNav() {
  const { count } = useCart();
  const items: { to: string; label: string; icon: IconName; end?: boolean; badge?: number }[] = [
    { to: "/", label: "Accueil", icon: "home", end: true },
    { to: "/explorer", label: "Explorer", icon: "search" },
    { to: "/compte/favoris", label: "Favoris", icon: "heart" },
    { to: "/panier", label: "Panier", icon: "bag", badge: count },
    { to: "/compte", label: "Compte", icon: "user", end: true },
  ];
  return (
    <nav
      aria-label="Navigation mobile"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-nuit/10 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            `relative flex flex-col items-center gap-0.5 py-2 text-xs font-semibold ${isActive ? "text-cobalt" : "text-nuit"}`
          }
        >
          <Icon name={it.icon} size={22} />
          {it.label}
          {!!it.badge && (
            <span className="tnum absolute right-[calc(50%-1.6rem)] top-1 grid h-4 min-w-4 place-items-center rounded-full bg-corail px-1 text-[10px] font-bold text-white">
              {it.badge}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function Footer() {
  const links: [string, string][] = [
    ["Explorer toutes les offres", "/explorer"],
    ["Produits", "/explorer?type=PHYSICAL_PRODUCT"],
    ["Services", "/explorer?type=SERVICE"],
    ["Réservations", "/explorer?type=BOOKING"],
    ["Numérique", "/explorer?type=DIGITAL_PRODUCT"],
  ];
  return (
    <footer className="mt-24 bg-nuit text-white">
      <div className={`${container} grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]`}>
        <div>
          <Logo light />
          <p className="mt-4 max-w-sm text-white/75">
            Un seul endroit pour trouver un objet, confier un travail, réserver une séance ou télécharger un fichier.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-bold">Parcourir</h2>
          <ul className="mt-3 space-y-2">
            {links.map(([label, to]) => (
              <li key={to}>
                <Link to={to} className="text-white/80 hover:text-white hover:underline">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-lg font-bold">Mon espace</h2>
          <ul className="mt-3 space-y-2">
            {(
              [
                ["Mon compte", "/compte"],
                ["Mes commandes", "/compte/commandes"],
                ["Mes réservations", "/compte/reservations"],
                ["Mon panier", "/panier"],
              ] as [string, string][]
            ).map(([label, to]) => (
              <li key={to}>
                <Link to={to} className="text-white/80 hover:text-white hover:underline">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="border-t border-white/15 py-5 text-center text-sm text-white/70">
        Site de démonstration : les offres et les paiements sont fictifs.
      </p>
    </footer>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function Layout() {
  return (
    <>
      <ScrollToTop />
      <Header />
      <main id="main" className="min-h-[60vh] pb-20 lg:pb-0">
        <Outlet />
      </main>
      <Footer />
      <MobileNav />
    </>
  );
}
