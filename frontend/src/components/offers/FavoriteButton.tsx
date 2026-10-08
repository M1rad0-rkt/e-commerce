import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useFavoriteIds, useToggleFavorite } from "../../hooks/queries";
import { errorMessage } from "../../utils/format";
import { Icon } from "../ui/Icon";

export function FavoriteButton({
  offerId,
  title,
  className = "",
}: {
  offerId: number;
  title: string;
  className?: string;
}) {
  const { user } = useAuth();
  const { data: ids } = useFavoriteIds();
  const toggle = useToggleFavorite();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const active = !!ids?.includes(offerId);

  function onClick() {
    if (!user) {
      navigate(`/connexion?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    toggle.mutate(
      { offerId, on: !active },
      {
        onSuccess: () => toast.push(active ? "Retirée de tes favoris." : "Ajoutée à tes favoris."),
        onError: (e) => toast.push(errorMessage(e), "error"),
      },
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? `Retirer « ${title} » des favoris` : `Ajouter « ${title} » aux favoris`}
      className={`grid h-10 w-10 place-items-center rounded-full bg-white/95 shadow-sm hover:bg-white ${
        active ? "text-corail" : "text-nuit"
      } ${className}`}
    >
      <Icon name="heart" size={20} filled={active} />
    </button>
  );
}
