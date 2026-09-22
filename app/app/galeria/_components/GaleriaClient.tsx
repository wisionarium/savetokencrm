"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2, Trash2, FolderPlus } from "lucide-react";
import { MagnifyingGlass, PencilSimple, ImageSquare } from "@/lib/ui/icons";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { prepararImagemParaUpload } from "@/lib/midia/comprimir-imagem";
import type { GaleriaArquivo, GaleriaPasta } from "@/lib/galeria/contrato";

const ORIGEM_LABEL: Record<string, string> = {
  chat: "Chat",
  disparo: "Disparo",
  fluxo: "Fluxo",
  galeria: "Galeria",
};

/**
 * Página da Galeria: grade pesquisável + pastas na lateral + upload +
 * renomear + mover + apagar (com aviso de onde é usado). Apagar aqui remove
 * do bucket; apagar fluxo/mensagem nunca toca aqui.
 */
export function GaleriaClient() {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);

  const [itens, setItens] = useState<GaleriaArquivo[]>([]);
  const [total, setTotal] = useState(0);
  const [pastas, setPastas] = useState<GaleriaPasta[]>([]);
  const [q, setQ] = useState("");
  const [pasta, setPasta] = useState<string>("tudo");
  const [carregando, setCarregando] = useState(true);
  const [subindo, setSubindo] = useState(false);
  const [novaPasta, setNovaPasta] = useState("");
  const [renomeando, setRenomeando] = useState<{ id: string; nome: string } | null>(null);
  const [apagando, setApagando] = useState<GaleriaArquivo | null>(null);
  const [usos, setUsos] = useState<{ mensagens: number; fluxos: number } | null>(null);

  const recarregar = useCallback(async () => {
    const [a, p] = await Promise.all([
      apiClient.get<{ data: GaleriaArquivo[]; meta?: { total?: number } }>(
        `/api/v1/media/galeria?limit=60${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}${
          pasta !== "tudo" ? `&pasta=${pasta}` : ""
        }`,
      ),
      apiClient.get<{ data: GaleriaPasta[] }>("/api/v1/media/galeria/pastas"),
    ]);
    setItens(a.data ?? []);
    setTotal(a.meta?.total ?? 0);
    setPastas(p.data ?? []);
  }, [q, pasta]);

  useEffect(() => {
    setCarregando(true);
    const id = window.setTimeout(() => {
      recarregar()
        .catch(() => {})
        .finally(() => setCarregando(false));
    }, 300);
    return () => window.clearTimeout(id);
  }, [recarregar]);

  const subir = async (file: File) => {
    setSubindo(true);
    try {
      const pronta = await prepararImagemParaUpload(file);
      const form = new FormData();
      form.append("file", pronta.blob, pronta.filename);
      if (pronta.largura > 0) form.append("largura", String(pronta.largura));
      if (pronta.altura > 0) form.append("altura", String(pronta.altura));
      if (pasta !== "tudo" && pasta !== "sem_pasta") form.append("pasta_id", pasta);
      const res = await fetch("/api/v1/media/galeria/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || t("Erro ao subir."));
      toast.success(t("Imagem na Galeria."));
      await recarregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Erro ao subir."));
    } finally {
      setSubindo(false);
    }
  };

  const criarPasta = async () => {
    if (!novaPasta.trim()) return;
    try {
      await apiClient.post("/api/v1/media/galeria/pastas", { nome: novaPasta.trim() });
      setNovaPasta("");
      await recarregar();
    } catch {
      toast.error(t("Não deu para criar a pasta."));
    }
  };

  const salvarNome = async () => {
    if (!renomeando || !renomeando.nome.trim()) return;
    try {
      await apiClient.patch(`/api/v1/media/galeria/${renomeando.id}`, {
        nome: renomeando.nome.trim(),
      });
      setRenomeando(null);
      await recarregar();
    } catch {
      toast.error(t("Não deu para renomear."));
    }
  };

  const mover = async (id: string, destino: string) => {
    try {
      await apiClient.patch(`/api/v1/media/galeria/${id}`, {
        pasta_id: destino === "sem_pasta" ? null : destino,
      });
      await recarregar();
    } catch {
      toast.error(t("Não deu para mover."));
    }
  };

  const pedirApagar = async (item: GaleriaArquivo) => {
    setApagando(item);
    setUsos(null);
    try {
      const r = await apiClient.get<{ data: { mensagens: number; fluxos: number } }>(
        `/api/v1/media/galeria?usos_de=${item.id}`,
      );
      setUsos(r.data);
    } catch {
      // avisa sem contagem
    }
  };

  const confirmarApagar = async () => {
    if (!apagando) return;
    try {
      await apiClient.delete(`/api/v1/media/galeria/${apagando.id}`);
      toast.success(t("Apagada da Galeria e do armazenamento."));
      setApagando(null);
      await recarregar();
    } catch {
      toast.error(t("Não deu para apagar."));
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Galeria")}</h1>
          <p className="text-sm text-text-muted">
            {t("As imagens do time — do chat, dos fluxos e as suas. O que o cliente mandou não entra aqui.")}
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void subir(f);
              e.target.value = "";
            }}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={subindo}>
            {subindo ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Upload size={14} className="mr-2" />}
            {t("Subir imagem")}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-hidden lg:flex-row">
        {/* Pastas */}
        <aside className="w-full shrink-0 space-y-2 lg:w-56">
          <div className="flex gap-1">
            <Input
              value={novaPasta}
              onChange={(e) => setNovaPasta(e.target.value)}
              placeholder={t("Nova pasta…")}
              maxLength={60}
              className="h-8 text-xs"
            />
            <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={criarPasta} title={t("Criar pasta")}>
              <FolderPlus size={14} />
            </Button>
          </div>
          <div className="flex flex-col gap-1">
            {[
              { id: "tudo", nome: `${t("Todas")} (${total})` },
              { id: "sem_pasta", nome: t("Sem pasta") },
              ...pastas.map((p) => ({ id: p.id, nome: `${p.nome} (${p.total_arquivos ?? 0})` })),
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setPasta(f.id)}
                className={`rounded-md px-2 py-1.5 text-left text-sm ${
                  pasta === f.id ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                }`}
              >
                {f.nome}
              </button>
            ))}
          </div>
        </aside>

        {/* Grade */}
        <div className="flex flex-1 flex-col gap-3 overflow-hidden">
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3 top-3 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("Pesquisar pelo nome…")}
              className="pl-9"
            />
          </div>

          <div className="grid flex-1 grid-cols-2 content-start gap-3 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-4">
            {carregando ? (
              <p className="col-span-full py-10 text-center text-sm text-muted-foreground">{t("Carregando…")}</p>
            ) : itens.length === 0 ? (
              <div className="col-span-full flex flex-col items-center gap-2 py-10 text-center">
                <ImageSquare size={28} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t("Nada por aqui ainda.")}</p>
              </div>
            ) : (
              itens.map((item) => (
                <div key={item.id} className="overflow-hidden rounded-lg border border-border bg-background">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.preview_url || ""} alt={item.nome} loading="lazy" className="aspect-square w-full object-cover" />
                  <div className="space-y-1 p-2">
                    {renomeando?.id === item.id ? (
                      <Input
                        autoFocus
                        value={renomeando.nome}
                        maxLength={120}
                        onChange={(e) => setRenomeando({ id: item.id, nome: e.target.value })}
                        onBlur={salvarNome}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void salvarNome();
                          if (e.key === "Escape") setRenomeando(null);
                        }}
                        className="h-7 text-xs"
                      />
                    ) : (
                      <p className="truncate text-xs font-medium" title={item.nome}>
                        {item.nome}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      {ORIGEM_LABEL[item.origem] ?? item.origem}
                    </p>
                    <div className="flex items-center gap-1">
                      <Select value={item.pasta_id ?? "sem_pasta"} onValueChange={(v) => void mover(item.id, v)}>
                        <SelectTrigger className="h-7 flex-1 text-[11px]" aria-label={t("Pasta")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sem_pasta">{t("Sem pasta")}</SelectItem>
                          {pastas.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setRenomeando({ id: item.id, nome: item.nome })}
                        title={t("Renomear")}
                      >
                        <PencilSimple size={13} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => void pedirApagar(item)}
                        title={t("Apagar")}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={!!apagando} onOpenChange={(o) => !o && setApagando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Apagar da Galeria?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Esta imagem sai da Galeria e é apagada do armazenamento:")} “{apagando?.nome}”
              {usos && (usos.mensagens > 0 || usos.fluxos > 0) ? (
                <>
                  <br />
                  {t("Ela aparece em mensagens e fluxos — esses lugares vão quebrar.")} (
                  {t("mensagens")}: {usos.mensagens} · {t("fluxos")}: {usos.fluxos})
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void confirmarApagar(); }}>
              {t("Apagar")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
