"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ProUnlockModal } from "./ProUnlockModal";

export function ProBanner({ isPro }: { isPro: boolean }) {
  const [modalOpen, setModalOpen] = useState(false);

  if (isPro) return null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200 font-bold">
            !
          </span>
          <span>
            <strong>Modo Demonstração:</strong> Sua empresa está no plano de avaliação. Os recursos completos estão bloqueados.
          </span>
        </div>
        <Button
          size="sm"
          onClick={() => setModalOpen(true)}
          className="h-7 rounded-md bg-amber-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-amber-700"
        >
          Desbloqueie seu Acesso PRO
        </Button>
      </div>

      <ProUnlockModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

export function ProButton() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Button
        size="sm"
        onClick={() => setModalOpen(true)}
        className="h-8 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-3 text-xs font-semibold text-white shadow hover:from-amber-600 hover:to-amber-700"
      >
        ✨ Desbloqueie seu Acesso PRO
      </Button>

      <ProUnlockModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
