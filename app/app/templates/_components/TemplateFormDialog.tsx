"use client";

import { useT } from "@/hooks/i18n/useT";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/api/client";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import type { MessageTemplate } from "@/hooks/inbox/useMessageTemplates";
import {
  TEMPLATE_VARIABLES,
  cleanTemplateSymbols,
  type TemplateVariableDef,
} from "@/lib/inbox/template-vars";

const TEMPLATES_KEY = ["message-templates"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canShare: boolean;
  template?: MessageTemplate | null;
}

interface CreateInput {
  title: string;
  body: string;
  shortcut?: string;
  shared?: boolean;
}

interface UpdateInput {
  id: string;
  title: string;
  body: string;
  shortcut: string | null;
}

export function TemplateFormDialog({ open, onOpenChange, canShare, template }: Props) {
  const t = useT();
  const isEdit = !!template;
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [shortcut, setShortcut] = React.useState("");
  const [shared, setShared] = React.useState(false);

  // Autocomplete do arroba @
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const mentionMenuRef = React.useRef<HTMLDivElement | null>(null);
  const [mentionOpen, setMentionOpen] = React.useState(false);
  const [mentionQuery, setMentionQuery] = React.useState("");
  const [mentionIndex, setMentionIndex] = React.useState(0);
  const [mentionMatch, setMentionMatch] = React.useState<{ start: number; end: number } | null>(null);

  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: async (input: CreateInput) =>
      apiClient.post<{ data: MessageTemplate }>("/api/v1/message-templates", input),
    onError: showApiError,
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
  const update = useMutation({
    mutationFn: async ({ id, ...input }: UpdateInput) =>
      apiClient.patch<{ data: MessageTemplate }>(`/api/v1/message-templates/${id}`, input),
    onError: showApiError,
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
  const pending = create.isPending || update.isPending;

  React.useEffect(() => {
    if (!open) {
      setMentionOpen(false);
      setMentionMatch(null);
      return;
    }
    setTitle(template?.title ?? "");
    // Limpa símbolos legados [] e {} transformando para @ ao abrir para edição
    setBody(cleanTemplateSymbols(template?.body ?? ""));
    setShortcut(template?.shortcut ?? "");
    setShared(template ? template.owner_user_id === null : false);
  }, [open, template]);

  const filteredVars = React.useMemo(() => {
    if (!mentionQuery) return TEMPLATE_VARIABLES;
    const q = mentionQuery.toLowerCase();
    return TEMPLATE_VARIABLES.filter(
      (v) =>
        v.key.toLowerCase().includes(q) ||
        v.label.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q),
    );
  }, [mentionQuery]);

  const checkMentionTrigger = (text: string, cursorPos: number) => {
    const beforeCursor = text.slice(0, cursorPos);
    // Identifica @ precedido por início de texto, espaço, pontuação ou linha
    const match = beforeCursor.match(/(?:^|[\s,.;:!?¡¿()\[\]{}"'«»])@([a-zA-Z0-9_]*)$/);
    if (match) {
      const rawQuery = match[1] ?? "";
      const atIndex = beforeCursor.lastIndexOf("@");
      setMentionQuery(rawQuery);
      setMentionMatch({ start: atIndex, end: cursorPos });
      setMentionOpen(true);
      setMentionIndex(0);
    } else {
      setMentionOpen(false);
      setMentionMatch(null);
    }
  };

  const insertVariable = (variableDef: TemplateVariableDef) => {
    const ta = textareaRef.current;
    const tag = `@${variableDef.key} `;
    let newBody = body;
    let nextPos = 0;

    if (mentionMatch) {
      newBody = body.slice(0, mentionMatch.start) + tag + body.slice(mentionMatch.end);
      nextPos = mentionMatch.start + tag.length;
    } else if (ta) {
      const start = ta.selectionStart ?? body.length;
      const end = ta.selectionEnd ?? body.length;
      newBody = body.slice(0, start) + tag + body.slice(end);
      nextPos = start + tag.length;
    } else {
      newBody = body + (body.endsWith(" ") || body === "" ? "" : " ") + tag;
      nextPos = newBody.length;
    }

    setBody(newBody);
    setMentionOpen(false);
    setMentionMatch(null);

    requestAnimationFrame(() => {
      if (ta) {
        ta.focus();
        ta.setSelectionRange(nextPos, nextPos);
      }
    });
  };

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let val = e.target.value;
    // Converte automaticamente colchetes e chaves digitados ou colados para @
    if (val.includes("{") || val.includes("[")) {
      val = cleanTemplateSymbols(val);
    }
    setBody(val);
    const cursor = e.target.selectionStart ?? val.length;
    checkMentionTrigger(val, cursor);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ao invés de chaves ou colchetes, converter imediatamente para @
    if (e.key === "{" || e.key === "[") {
      e.preventDefault();
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart ?? body.length;
      const end = ta.selectionEnd ?? body.length;
      const nextText = body.slice(0, start) + "@" + body.slice(end);
      setBody(nextText);
      const nextPos = start + 1;
      requestAnimationFrame(() => {
        ta.setSelectionRange(nextPos, nextPos);
        checkMentionTrigger(nextText, nextPos);
      });
      return;
    }

    if (mentionOpen && filteredVars.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % filteredVars.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + filteredVars.length) % filteredVars.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const selected = filteredVars[mentionIndex];
        if (selected) {
          insertVariable(selected);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionOpen(false);
        return;
      }
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const sanitizedBody = cleanTemplateSymbols(body.trim());
      if (isEdit) {
        await update.mutateAsync({
          id: template.id,
          title: title.trim(),
          body: sanitizedBody,
          shortcut: shortcut.trim() || null,
        });
        toast.success(t("Template atualizado."));
      } else {
        await create.mutateAsync({
          title: title.trim(),
          body: sanitizedBody,
          shortcut: shortcut.trim() || undefined,
          shared: canShare ? shared : false,
        });
        toast.success(t("Template criado."));
      }
      onOpenChange(false);
    } catch {
      /* erro já mostrado pelo showApiError */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("Editar resposta rápida") : t("Nova resposta rápida")}</DialogTitle>
          <DialogDescription>
            {t("Scripts salvos para responder mais rápido no atendimento com dados automáticos.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tpl-title">{t("Título")}</Label>
            <Input
              id="tpl-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("Ex: Saudação com agendamento")}
              minLength={1}
              maxLength={80}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="tpl-body">{t("Mensagem")}</Label>
              <span className="text-xs text-muted-foreground">
                {t("Digite @ para sugerir informações")}
              </span>
            </div>

            <div className="relative">
              <Textarea
                ref={textareaRef}
                id="tpl-body"
                value={body}
                onChange={handleBodyChange}
                onKeyDown={handleKeyDown}
                onClick={(e) =>
                  checkMentionTrigger(body, (e.target as HTMLTextAreaElement).selectionStart ?? body.length)
                }
                onKeyUp={(e) =>
                  checkMentionTrigger(body, (e.target as HTMLTextAreaElement).selectionStart ?? body.length)
                }
                placeholder={t("Oi @primeiro_nome, tudo bem? Aqui é da equipe...")}
                minLength={1}
                maxLength={4096}
                required
                rows={5}
                className="font-sans"
              />

              {/* Popover / Menu de sugestão do @ */}
              {mentionOpen && (
                <div
                  ref={mentionMenuRef}
                  className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border bg-popover p-1.5 text-popover-foreground shadow-xl animate-in fade-in-50 zoom-in-95"
                >
                  <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b mb-1">
                    <span>{t("Informações da pessoa que chama")}</span>
                    <span className="text-[10px] font-normal normal-case">Enter ou clique para escolher</span>
                  </div>

                  {filteredVars.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                      {t("Nenhuma informação encontrada para")} &quot;{mentionQuery}&quot;
                    </div>
                  ) : (
                    <ul className="space-y-0.5" role="listbox">
                      {filteredVars.map((v, idx) => {
                        const isSelected = idx === mentionIndex;
                        return (
                          <li
                            key={v.key}
                            role="option"
                            aria-selected={isSelected}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              insertVariable(v);
                            }}
                            onMouseEnter={() => setMentionIndex(idx)}
                            className={`flex cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                              isSelected
                                ? "bg-primary text-primary-foreground font-medium"
                                : "hover:bg-muted text-foreground"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold ${
                                  isSelected
                                    ? "bg-primary-foreground/20 text-primary-foreground"
                                    : "bg-primary/10 text-primary"
                                }`}
                              >
                                @
                              </span>
                              <div className="min-w-0">
                                <div className="truncate font-medium">{v.label}</div>
                                <div
                                  className={`truncate text-[10px] ${
                                    isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                                  }`}
                                >
                                  {v.description} ({t("Ex:")} {v.example})
                                </div>
                              </div>
                            </div>
                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono ${
                                isSelected
                                  ? "bg-primary-foreground/20 text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {v.badge}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Chips de atalhos rápidos com 1 clique */}
            <div className="space-y-1.5 pt-1.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{t("Inserir variável rápida:")}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-secondary/50 px-2 py-1 text-xs font-medium text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                    title={`${v.description} - Exemplo: ${v.example}`}
                  >
                    <span className="font-bold text-primary hover:text-inherit">@</span>
                    <span>{v.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tpl-shortcut">{t("Atalho (opcional)")}</Label>
            <Input
              id="tpl-shortcut"
              value={shortcut}
              onChange={(e) => setShortcut(e.target.value)}
              placeholder="oi"
              maxLength={40}
            />
          </div>

          {canShare && (
            <div className="flex items-center gap-2">
              <Switch
                id="tpl-shared"
                checked={shared}
                onCheckedChange={setShared}
                disabled={isEdit}
              />
              <Label htmlFor="tpl-shared">{t("Compartilhar com a equipe")}</Label>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("Cancelar")}
            </Button>
            <Button type="submit" disabled={pending}>
              {isEdit ? t("Salvar") : t("Criar template")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

