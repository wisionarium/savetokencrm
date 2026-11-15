"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMessageTemplates, type MessageTemplate } from "@/hooks/inbox/useMessageTemplates";
import { useT } from "@/hooks/i18n/useT";
import { ChatCircle, MagnifyingGlass, Plus } from "@/lib/ui/icons";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (body: string, template: MessageTemplate) => void;
}

export function QuickMessagePickerDialog({ open, onOpenChange, onSelect }: Props) {
  const t = useT();
  const { data: templates, isPending } = useMessageTemplates();
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();
  const filtered = (templates ?? []).filter((tpl) => {
    if (!q) return true;
    return (
      tpl.title.toLowerCase().includes(q) ||
      (tpl.shortcut ?? "").toLowerCase().includes(q) ||
      tpl.body.toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ChatCircle size={20} className="text-primary" />
            {t("Respostas Rápidas")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-1">
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3 top-3 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Buscar por título, atalho (/...) ou conteúdo...")}
              className="pl-9 h-9 text-xs"
              autoFocus
            />
          </div>

          <div className="max-h-80 overflow-y-auto flex flex-col gap-2 pr-1">
            {isPending ? (
              <p className="py-8 text-center text-xs text-muted-foreground">{t("Carregando respostas rápidas…")}</p>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                {(templates ?? []).length === 0
                  ? t("Nenhuma resposta rápida cadastrada ainda. Crie em Respostas Rápidas no menu lateral para usar aqui.")
                  : t("Nenhuma resposta rápida encontrada com esse termo.")}
              </div>
            ) : (
              filtered.map((tpl) => (
                <div
                  key={tpl.id}
                  className="group flex flex-col gap-1.5 rounded-xl border border-border/60 bg-surface p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/10 cursor-pointer"
                  onClick={() => {
                    onSelect(tpl.body, tpl);
                    onOpenChange(false);
                    setSearch("");
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                      {tpl.title}
                    </span>
                    {tpl.shortcut && (
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-mono">
                        {tpl.shortcut.startsWith("/") ? tpl.shortcut : `/${tpl.shortcut}`}
                      </Badge>
                    )}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground whitespace-pre-wrap">
                    {tpl.body}
                  </p>
                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[11px] font-medium text-primary hover:bg-primary/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(tpl.body, tpl);
                        onOpenChange(false);
                        setSearch("");
                      }}
                    >
                      <Plus size={12} className="mr-1" />
                      {t("Usar este texto")}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
