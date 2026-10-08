const API_URL: string = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

const ACCESS_KEY = "comptoir.access";
const REFRESH_KEY = "comptoir.refresh";

// Les jetons sont gardés dans localStorage : simple, mais lisible par un script injecté (XSS).
// Pour un déploiement public, prévoir des cookies httpOnly côté serveur.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export const tokens = {
  get access() {
    return read(ACCESS_KEY);
  },
  get refresh() {
    return read(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    try {
      localStorage.setItem(ACCESS_KEY, access);
      localStorage.setItem(REFRESH_KEY, refresh);
    } catch {
      /* stockage indisponible : la session ne survivra pas au rechargement */
    }
  },
  clear() {
    try {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* rien à faire */
    }
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Params = Record<string, string | number | boolean | null | undefined | (string | number)[]>;

export function qs(params?: Params): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    if (Array.isArray(value)) value.forEach((v) => sp.append(key, String(v)));
    else sp.set(key, String(value));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

interface Options {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  params?: Params;
  /** false : n'envoie pas le jeton et ne tente pas de rafraîchissement (connexion, inscription). */
  auth?: boolean;
}

let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const refresh = tokens.refresh;
  if (!refresh) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      tokens.set(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

function messageFrom(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return "Certains champs du formulaire ne sont pas valides.";
  return fallback;
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const { method = "GET", body, params, auth = true } = options;

  const send = () => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth && tokens.access) headers.Authorization = `Bearer ${tokens.access}`;
    return fetch(`${API_URL}/api${path}${qs(params)}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res: Response;
  try {
    res = await send();
  } catch {
    throw new ApiError(0, "Impossible de joindre le serveur. Vérifie ta connexion et réessaie.");
  }

  if (res.status === 401 && auth && tokens.refresh) {
    if (await refreshSession()) {
      res = await send();
    } else {
      tokens.clear();
      window.dispatchEvent(new Event("comptoir:logout"));
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, messageFrom(data, "Une erreur est survenue. Réessaie dans un instant."));
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
