import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { EmptyState, Spinner } from "../ui/kit";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="Vérification de ta session…" />;
  if (!user) return <Navigate to={`/connexion?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="Vérification de ta session…" />;
  if (!user) return <Navigate to={`/connexion?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (!isAdmin)
    return (
      <EmptyState title="Accès réservé" action={{ to: "/", label: "Retour à l'accueil" }}>
        Cette section est réservée aux administrateurs.
      </EmptyState>
    );
  return <>{children}</>;
}
