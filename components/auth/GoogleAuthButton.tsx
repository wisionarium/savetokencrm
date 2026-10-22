"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useT } from "@/hooks/i18n/useT";

interface GoogleAuthButtonProps {
  label?: string;
  next?: string;
  invite?: string;
  className?: string;
}

export function GoogleAuthButton({
  label,
  next,
  invite,
  className = "",
}: GoogleAuthButtonProps) {
  const t = useT();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    try {
      setCarregando(true);
      setErro(null);

      const supabase = createClient();
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";

      const queryParams = new URLSearchParams();
      if (next) queryParams.set("next", next);
      if (invite) queryParams.set("invite", invite);

      const qs = queryParams.toString();
      const callbackUrl = `${origin}/auth/callback${qs ? `?${qs}` : ""}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });

      if (error) {
        setErro(t("Não foi possível conectar com o Google."));
        setCarregando(false);
      }
    } catch {
      setErro(t("Erro inesperado ao conectar com o Google."));
      setCarregando(false);
    }
  };

  return (
    <div className="w-full space-y-2">
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={carregando}
        className={`flex w-full items-center justify-center gap-3 rounded-md border border-input bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-xs transition-all hover:border-foreground/30 hover:bg-accent/40 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 ${className}`}
      >
        {carregando ? (
          <div className="flex items-center gap-2">
            <svg
              className="h-4 w-4 animate-spin text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span className="text-muted-foreground">{t("Conectando...")}</span>
          </div>
        ) : (
          <>
            <svg
              className="h-4 w-4 shrink-0"
              viewBox="0 0 24 24"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            <span>{t(label || "Continuar com o Google")}</span>
          </>
        )}
      </button>

      {erro && (
        <p className="text-center text-xs text-destructive" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
