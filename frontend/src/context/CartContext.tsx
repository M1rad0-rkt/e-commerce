import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { cartSubtotal, isCartLine, lineKey, type CartLine } from "../utils/cart";

const STORAGE_KEY = "comptoir.cart";

export type AddResult = "added" | "updated" | "exists" | "limit";

interface CartApi {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (line: Omit<CartLine, "key">) => AddResult;
  setQuantity: (key: string, quantity: number) => void;
  setDetails: (key: string, details: string) => void;
  remove: (key: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartApi | null>(null);

function load(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isCartLine) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* le panier ne survivra pas au rechargement */
    }
  }, [lines]);

  // Synchronise plusieurs onglets ouverts.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && setLines(load());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback(
    (line: Omit<CartLine, "key">): AddResult => {
      const key = lineKey(line.offerId, line.slotId);
      const existing = lines.find((l) => l.key === key);
      if (!existing) {
        setLines((ls) => [...ls, { ...line, key }]);
        return "added";
      }
      if (existing.maxQuantity <= 1) return "exists";
      const quantity = Math.min(existing.maxQuantity, existing.quantity + line.quantity);
      if (quantity === existing.quantity) return "limit";
      setLines((ls) => ls.map((l) => (l.key === key ? { ...l, quantity, details: line.details ?? l.details } : l)));
      return "updated";
    },
    [lines],
  );

  const value = useMemo<CartApi>(
    () => ({
      lines,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      subtotal: cartSubtotal(lines),
      add,
      setQuantity: (key, quantity) =>
        setLines((ls) =>
          ls.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, Math.min(l.maxQuantity, quantity)) } : l)),
        ),
      setDetails: (key, details) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, details } : l))),
      remove: (key) => setLines((ls) => ls.filter((l) => l.key !== key)),
      clear: () => setLines([]),
    }),
    [lines, add],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart doit être utilisé dans <CartProvider>");
  return ctx;
}
