"use client";

import { Flame } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/**
 * A chaminha do lead quente (streak de engajamento, v1 visual).
 *
 * Aparece lá embaixo na linha da conversa, junto dos selos — e só quando a
 * régua (`engajamentoDaConversa`, em `lib/inbox/engajamento.ts`) diz "quente".
 * O `title` carrega o motivo ("Respondeu agora há pouco", "4 mensagens sem
 * resposta"): número sem o "e daí?" é ruído (sistema-vivo 5).
 *
 * Cor e movimento seguem o tema: tinta de `--color-warning` sobre
 * `--color-warning-bg` (os mesmos tokens do badge `warning`), e a animação é
 * CSS em `app/globals.css` (`.chama-quente`) — com `prefers-reduced-motion` a
 * chama fica parada, nunca some (ver o media query lá).
 */
export function ChamaDeEngajamento({ motivo }: { motivo: string }) {
  return (
    <span
      role="img"
      aria-label={`Lead quente: ${motivo}`}
      title={motivo}
      className={cn(
        "inline-flex h-4 items-center gap-0.5 rounded-full bg-warning-bg px-1.5",
        "text-[10px] font-semibold text-warning-fg",
      )}
    >
      <Flame size={11} weight="fill" className="chama-quente" aria-hidden />
      quente
    </span>
  );
}
