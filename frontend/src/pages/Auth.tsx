import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { Field, FormError, Seo } from "../components/ui/kit";
import { btn, container, inputCls } from "../components/ui/styles";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import type { Message } from "../types";
import { errorMessage } from "../utils/format";

/** N'accepte que les chemins internes : évite une redirection vers un site extérieur. */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/compte";
}

function Shell({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className={`${container} grid place-items-start py-10 sm:py-16`}>
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-4xl sm:text-5xl">{title}</h1>
        {sub && <p className="mt-3 text-muted">{sub}</p>}
        <div className="mt-8 rounded-2xl bg-white p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { user, login } = useAuth();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(sp.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const m = useMutation({
    mutationFn: () => login(email.trim(), password),
    onSuccess: () => navigate(next, { replace: true }),
  });

  if (user && !m.isPending && !m.isSuccess) return <Navigate to={next} replace />;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    m.mutate();
  }

  return (
    <Shell
      title="Connexion"
      sub={
        <>
          Pas encore de compte ?{" "}
          <Link to={`/inscription?next=${encodeURIComponent(next)}`} className="font-semibold text-nuit underline underline-offset-4">
            Crée-le en une minute
          </Link>
          .
        </>
      }
    >
      <Seo title="Connexion" />
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Adresse e-mail">
          <input required type="email" autoComplete="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Mot de passe">
          <input required type="password" autoComplete="current-password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <FormError message={m.error ? errorMessage(m.error) : null} />
        <button type="submit" disabled={m.isPending} className={btn("primary", "lg", "w-full")}>
          {m.isPending ? "Connexion…" : "Se connecter"}
        </button>
        <p className="text-center">
          <Link to="/mot-de-passe-oublie" className="font-semibold underline underline-offset-4">
            Mot de passe oublié ?
          </Link>
        </p>
      </form>
    </Shell>
  );
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(sp.get("next"));
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });

  const m = useMutation({
    mutationFn: () => register(form.full_name.trim(), form.email.trim(), form.password),
    onSuccess: () => navigate(next, { replace: true }),
  });

  if (user && !m.isPending && !m.isSuccess) return <Navigate to={next} replace />;

  return (
    <Shell
      title="Créer un compte"
      sub={
        <>
          Déjà inscrit ?{" "}
          <Link to={`/connexion?next=${encodeURIComponent(next)}`} className="font-semibold text-nuit underline underline-offset-4">
            Connecte-toi
          </Link>
          .
        </>
      }
    >
      <Seo title="Inscription" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
        className="space-y-4"
      >
        <Field label="Nom complet">
          <input required minLength={2} autoComplete="name" className={inputCls} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </Field>
        <Field label="Adresse e-mail">
          <input required type="email" autoComplete="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Mot de passe" hint="8 caractères minimum.">
          <input required minLength={8} type="password" autoComplete="new-password" className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <FormError message={m.error ? errorMessage(m.error) : null} />
        <button type="submit" disabled={m.isPending} className={btn("primary", "lg", "w-full")}>
          {m.isPending ? "Création…" : "Créer mon compte"}
        </button>
      </form>
    </Shell>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const m = useMutation({
    mutationFn: () => api<Message>("/auth/forgot-password", { method: "POST", body: { email: email.trim() }, auth: false }),
  });

  return (
    <Shell title="Mot de passe oublié" sub="Indique l'adresse de ton compte : on prépare un lien pour choisir un nouveau mot de passe.">
      <Seo title="Mot de passe oublié" />
      {m.isSuccess ? (
        <div role="status" className="space-y-3">
          <p className="font-semibold">{m.data.detail}</p>
          <p className="text-sm text-muted">
            En local, aucun e-mail n'est envoyé : le lien s'affiche dans la console du serveur (la fenêtre où tourne
            <code className="mx-1 rounded bg-brume px-1">uvicorn</code>).
          </p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
          className="space-y-4"
        >
          <Field label="Adresse e-mail">
            <input required type="email" autoComplete="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <FormError message={m.error ? errorMessage(m.error) : null} />
          <button type="submit" disabled={m.isPending} className={btn("primary", "lg", "w-full")}>
            {m.isPending ? "Préparation…" : "Préparer le lien"}
          </button>
        </form>
      )}
      <p className="mt-5 text-center">
        <Link to="/connexion" className="font-semibold underline underline-offset-4">
          Retour à la connexion
        </Link>
      </p>
    </Shell>
  );
}

export function ResetPasswordPage() {
  const [sp] = useSearchParams();
  const token = sp.get("token") ?? "";
  const [password, setPassword] = useState("");
  const m = useMutation({
    mutationFn: () => api<Message>("/auth/reset-password", { method: "POST", body: { token, new_password: password }, auth: false }),
  });

  return (
    <Shell title="Nouveau mot de passe">
      <Seo title="Nouveau mot de passe" />
      {!token ? (
        <p role="alert">
          Ce lien est incomplet.{" "}
          <Link to="/mot-de-passe-oublie" className="font-semibold underline">
            Demande-en un nouveau
          </Link>
          .
        </p>
      ) : m.isSuccess ? (
        <div role="status" className="space-y-4">
          <p className="font-semibold">{m.data.detail}</p>
          <Link to="/connexion" className={btn("primary", "lg", "w-full")}>
            Se connecter
          </Link>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
          className="space-y-4"
        >
          <Field label="Nouveau mot de passe" hint="8 caractères minimum.">
            <input required minLength={8} type="password" autoComplete="new-password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <FormError message={m.error ? errorMessage(m.error) : null} />
          <button type="submit" disabled={m.isPending} className={btn("primary", "lg", "w-full")}>
            {m.isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>
      )}
    </Shell>
  );
}
