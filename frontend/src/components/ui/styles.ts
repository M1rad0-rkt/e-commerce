export const inputCls =
  "block w-full rounded-lg border border-nuit/30 bg-white px-3.5 py-2.5 text-base text-nuit placeholder:text-muted/70 focus-visible:border-cobalt focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-cobalt disabled:bg-nuit/5 disabled:text-muted";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "light";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-nuit text-white hover:bg-cobalt disabled:hover:bg-nuit",
  secondary: "border-2 border-nuit text-nuit hover:bg-nuit hover:text-white",
  ghost: "text-nuit hover:bg-nuit/10",
  danger: "border-2 border-corail text-corail hover:bg-corail hover:text-white",
  light: "bg-white text-nuit hover:bg-safran",
};

const sizes: Record<Size, string> = {
  sm: "px-3.5 py-1.5 text-sm",
  md: "px-5 py-2.5 text-base",
  lg: "px-7 py-3.5 text-lg",
};

export const btn = (variant: Variant = "primary", size: Size = "md", extra = "") =>
  `${base} ${variants[variant]} ${sizes[size]} ${extra}`.trim();

export const container = "mx-auto w-full max-w-7xl px-4 sm:px-6";
