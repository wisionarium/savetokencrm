"use client";

import { useEffect, useState } from "react";

import { MagnifyingGlass } from "@/lib/ui/icons";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { GaleriaArquivo, GaleriaPasta } from "@/lib/galeria/contrato";

export interface GaleriaPick {
  storage_path: string;
  preview_url?: string;
  nome: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (pick: GaleriaPick) => void;
}

/**
 * Acesso rápido à Galeria: pesquisa por nome + filtro de pasta, grade com
 * prévia, clicar escolhe. Usado no editor de disparo e no chat.
 */
export function SeletorDaGaleria({ open, onOpenChange, onPick }: Props) {
  const t = useT();
  const [q, setQ] = useState("");
  const [pasta, setPasta] = useState<string>("tudo");
  const [pastas, setPastas] = useState<GaleriaPasta[]>([]);
  const [itens, setItens] = useState<GaleriaArquivo[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCarregando(true);
    Promise.all([
      apiClient.get<{ data: GaleriaPasta[] }>("/api/v1/media/galeria/pastas"),
      apiClient.get<{ data: GaleriaArquivo[] }>(
        `/api/v1/media/galeria?limit=60${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}${
          pasta !== "tudo" ? `&pasta=${pasta === "sem_pasta" ? "sem_pasta" : pasta}` : ""
        }`,
      ),
    ])
      .then(([p, a]) => {
        setPastas(p.data ?? []);
        setItens(a.data ?? []);
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pasta]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      apiClient
        .get<{ data: GaleriaArquivo[] }>(
          `/api/v1/media/galeria?limit=60${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}${
            pasta !== "tudo" ? `&pasta=${pasta === "sem_pasta" ? "sem_pasta" : pasta}` : ""
          }`,
        )
        .then((r) => setItens(r.data ?? []))
        .catch(() => {});
    }, 350);
    return () => window.clearTimeout(id);
  }, [q, open, pasta]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("Galeria — escolher imagem")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MagnifyingGlass size={16} className="absolute left-3 top-3 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("Pesquisar pelo nome…")}
                className="pl-9"
              />
            </div>
            <Select value={pasta} onValueChange={setPasta}>
              <SelectTrigger className="w-40" aria-label={t("Pasta")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tudo">{t("Todas")}</SelectItem>
                <SelectItem value="sem_pasta">{t("Sem pasta")}</SelectItem>
                {pastas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
            {carregando ? (
              <p className="col-span-full py-8 text-center text-xs text-muted-foreground">
                {t("Carregando…")}
              </p>
            ) : itens.length === 0 ? (
              <p className="col-span-full py-8 text-center text-xs text-muted-foreground">
                {t("Nada por aqui — suba imagens na página Galeria.")}
              </p>
            ) : (
              itens.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onPick({
                      storage_path: item.storage_path,
                      preview_url: item.preview_url,
                      nome: item.nome,
                    });
                    onOpenChange(false);
                  }}
                  className="group overflow-hidden rounded-lg border border-border text-left hover:border-primary"
                  title={item.nome}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.preview_url || ""}
                    alt={item.nome}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                  <p className="truncate px-1.5 py-1 text-[11px] text-muted-foreground group-hover:text-foreground">
                    {item.nome}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {t("Cancelar")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
