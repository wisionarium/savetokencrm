"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const WHATSAPP_PRO_LINK =
  "https://wa.me/5521967757228?text=Ol%C3%A1%2C%20gostaria%20de%20finalizar%20o%20Plano%20PRO%20do%20Tecla%20CRM!";
const TELEFONE_CONTATO = "55 21 96775-7228";

interface ProUnlockModalProps {
  open: boolean;
  onClose: () => void;
}

export function ProUnlockModal({ open, onClose }: ProUnlockModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border bg-card p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Botão fechar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Fechar"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Cabeçalho */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
            <span>✨</span>
            <span>Plano Empresarial Exclusivo</span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Desbloqueie o Tecla CRM PRO
          </h3>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            A infraestrutura completa de atendimento e vendas pelo WhatsApp oficial da sua empresa,
            sem limites e com estabilidade profissional.
          </p>
        </div>

        {/* Vantagens PRO */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 text-left">
          <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              ✓
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">API Oficial da Meta</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Conexão direta Cloud API com alta taxa de entrega e zero risco de bloqueio.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              ✓
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">CRM & Funis de Vendas</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pipelines organizados por etapas, kanban, motivos de perda e histórico unificado.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              ✓
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Sistema Multi-Atendentes</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Convide sua equipe, distribua conversas automaticamente e controle permissões.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              ✓
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Galeria & Mídias Rápidas</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Envie áudios gravados, imagens, vídeos, PDFs e propostas comerciais em 1 clique.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              ✓
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Gestão de Contatos</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Etiquetas personalizadas, campos customizados e importação/exportação rápida.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              ✓
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Suporte Especializado</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Acompanhamento na implantação e atendimento humanizado prioritário.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 space-y-3 text-center">
          <a
            href={WHATSAPP_PRO_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg transition-colors hover:bg-emerald-700"
          >
            <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.699.073-1.133-.067-.282-.09-1.222-.44-2.328-1.425-1.408-1.253-1.571-2.001-1.722-2.253-.15-.252-.397-.677-.397-1.16 0-.482.253-.72.342-.819.09-.098.241-.144.385-.144.048 0 .093.003.136.006.126.006.273-.021.405.295.144.343.491 1.199.533 1.286.042.086.071.187.014.3-.057.114-.086.186-.172.287-.086.101-.182.226-.26.304-.088.087-.18.181-.077.357.103.176.459.757.985 1.226.678.605 1.25.793 1.428.88.178.088.283.073.388-.048.106-.12.455-.53.576-.713.12-.182.242-.152.404-.092.164.06 1.037.489 1.215.578.178.089.297.133.341.208.044.075.044.435-.1 1.017z" />
            </svg>
            Finalizar Plano PRO no WhatsApp
          </a>

          <p className="text-xs text-muted-foreground">
            Atendimento direto pelo WhatsApp: <strong className="text-foreground">{TELEFONE_CONTATO}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
