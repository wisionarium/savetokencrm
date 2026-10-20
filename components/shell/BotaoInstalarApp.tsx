"use client";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { DownloadSimple } from "@/lib/ui/icons";

/**
 * O navegador avisa UMA vez, quando o app já cumpre os critérios de instalação
 * (manifest com ícones, service worker com handler de rede e HTTPS). Guardar o
 * evento é o que permite oferecer o convite no nosso botão, no lugar do
 * mini-infobar automático — que some sozinho e não volta.
 *
 * O tipo não está no `lib.dom` do TypeScript; declaramos só o que usamos.
 */
interface EventoDeInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Instala o app na tela inicial. Só aparece quando o navegador permite. */
export function BotaoInstalarApp() {
  const t = useT();
  const [evento, setEvento] = useState<EventoDeInstalacao | null>(null);

  useEffect(() => {
    function aoPoderInstalar(e: Event) {
      // `preventDefault` esconde o banner automático do Chrome; sem ele o
      // convite apareceria duas vezes (o banner e este botão).
      e.preventDefault();
      setEvento(e as EventoDeInstalacao);
    }
    function aoInstalar() {
      setEvento(null);
    }
    window.addEventListener("beforeinstallprompt", aoPoderInstalar);
    window.addEventListener("appinstalled", aoInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", aoPoderInstalar);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  if (!evento) return null;

  return (
    <div className="border-b border-border p-3">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start gap-2"
        onClick={async () => {
          await evento.prompt();
          // O evento só serve uma vez — aceito ou recusado, o navegador não o
          // reemite nesta sessão. Não ler `userChoice` de propósito: o produto
          // não muda nada se a pessoa recusar, e um toast "instalação
          // cancelada" seria cobrança em cima de uma escolha legítima.
          setEvento(null);
        }}
      >
        <DownloadSimple size={16} aria-hidden />
        {t("Instalar aplicativo")}
      </Button>
    </div>
  );
}
