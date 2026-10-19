"use client";

import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { ZOOM_MAX, ZOOM_MIN, useZoomDoFio } from "@/lib/inbox/zoom-do-fio";
import { MagnifyingGlassMinus, MagnifyingGlassPlus } from "@/lib/ui/icons";

/**
 * ═══ PÍLULA DE ZOOM DO FIO ═══
 *
 * Mora no canto superior direito do fio, logo ABAIXO dos ícones de ligar e do
 * robô do cabeçalho (`ConversationHeader`) — o pedido do dono foi exatamente
 * esse endereço, e é onde a mão já está depois de usar aqueles dois.
 *
 * É `absolute` DENTRO do mesmo contêiner relativamente posicionado que segura o
 * fio, mas FORA do elemento que carrega `data-zoom-do-fio`: se ficasse dentro,
 * ela própria encolheria/cresceria junto e o alvo do clique andaria enquanto se
 * ajusta o texto.
 *
 * Os dois botões desabilitam nas pontas (80% e 140%) — em vez de sumir, o que
 * empurraria a pílula de lugar no último clique.
 */
export function ZoomDoFio({ userId }: { userId: string | null }) {
  const t = useT();
  const { zoom, aumentar, diminuir, podeAumentar, podeDiminuir } = useZoomDoFio(userId);

  return (
    <div
      className="absolute right-2 top-2 z-20 flex items-center gap-0.5 rounded-full border border-border bg-background/90 px-1 py-0.5 shadow-sm backdrop-blur"
      data-testid="zoom-do-fio"
    >
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0"
        onClick={diminuir}
        disabled={!podeDiminuir}
        aria-label={t("Diminuir o texto da conversa")}
        title={`${t("Diminuir o texto")} (${ZOOM_MIN}%)`}
        data-testid="zoom-do-fio-diminuir"
      >
        <MagnifyingGlassMinus size={14} weight="bold" aria-hidden />
      </Button>
      <span
        className="min-w-8 select-none text-center text-[11px] font-medium tabular-nums text-muted-foreground"
        data-testid="zoom-do-fio-valor"
        aria-live="polite"
      >
        {zoom}%
      </span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0"
        onClick={aumentar}
        disabled={!podeAumentar}
        aria-label={t("Aumentar o texto da conversa")}
        title={`${t("Aumentar o texto")} (${ZOOM_MAX}%)`}
        data-testid="zoom-do-fio-aumentar"
      >
        <MagnifyingGlassPlus size={14} weight="bold" aria-hidden />
      </Button>
    </div>
  );
}
