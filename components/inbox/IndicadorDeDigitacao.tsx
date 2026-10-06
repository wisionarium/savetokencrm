"use client";

import { useT } from "@/hooks/i18n/useT";
import { cn } from "@/lib/utils";
import type { AvisoDeDigitacao } from "@/lib/inbox/digitacao";

/**
 * "Ana está digitando…" — o indicador do CRM, par do "digitando" do WhatsApp.
 *
 * Bolha à esquerda (lado de quem escreve), com três pontos que sobem e descem
 * (`.digitacao-pontos`, em `app/globals.css`) — o mesmo vocabulário do
 * "quente" da lista: animação lenta, e parada com `prefers-reduced-motion`.
 * O verbo muda com o que o outro está fazendo: texto, áudio ou arquivo.
 */
export function IndicadorDeDigitacao({
  aviso,
  texto,
}: {
  /** Quem digita (verbo sai do `kind`) — ou `texto` pronto, para atividade sem autor. */
  aviso?: AvisoDeDigitacao;
  texto?: string;
}) {
  const t = useT();
  const frase =
    texto ??
    (aviso
      ? `${aviso.nome} ${
          aviso.kind === "audio"
            ? t("gravando áudio")
            : aviso.kind === "file"
              ? t("enviando arquivo")
              : t("está digitando")
        }`
      : "");
  return (
    <div className="flex justify-start px-4 pb-1" aria-live="polite">
      <div
        className={cn(
          "flex max-w-[80%] items-center gap-2 rounded-2xl rounded-bl-md",
          "bg-surface-elevated px-3 py-2",
        )}
      >
        <span className="digitacao-pontos" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="text-xs text-text-muted">
          {frase}…
        </span>
      </div>
    </div>
  );
}
