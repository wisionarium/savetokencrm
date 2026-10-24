"use client";

import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { ZOOM_MAX, ZOOM_MIN, useZoomDoFio } from "@/lib/inbox/zoom-do-fio";
import { MagnifyingGlassMinus, MagnifyingGlassPlus } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/**
 * ═══ PÍLULA DE ZOOM DO FIO ═══
 *
 * Localizada abaixo do ícone do robô no cabeçalho da conversa (`ConversationHeader`).
 * Os dois botões desabilitam nas pontas (80% e 140%).
 */
export function ZoomDoFio({ userId, className }: { userId: string | null; className?: string }) {
  const t = useT();
  const { zoom, aumentar, diminuir, podeAumentar, podeDiminuir } = useZoomDoFio(userId);

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-full border border-border bg-background px-1 py-0.5 shadow-xs",
        className,
      )}
      data-testid="zoom-do-fio"
    >
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-5 w-5 p-0"
        onClick={diminuir}
        disabled={!podeDiminuir}
        aria-label={t("Diminuir o texto da conversa")}
        title={`${t("Diminuir o texto")} (${ZOOM_MIN}%)`}
        data-testid="zoom-do-fio-diminuir"
      >
        <MagnifyingGlassMinus size={12} weight="bold" aria-hidden />
      </Button>
      <span
        className="min-w-6 select-none text-center text-[10px] font-medium tabular-nums text-muted-foreground"
        data-testid="zoom-do-fio-valor"
        aria-live="polite"
      >
        {zoom}%
      </span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-5 w-5 p-0"
        onClick={aumentar}
        disabled={!podeAumentar}
        aria-label={t("Aumentar o texto da conversa")}
        title={`${t("Aumentar o texto")} (${ZOOM_MAX}%)`}
        data-testid="zoom-do-fio-aumentar"
      >
        <MagnifyingGlassPlus size={12} weight="bold" aria-hidden />
      </Button>
    </div>
  );
}
