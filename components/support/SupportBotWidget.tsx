"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTicket } from "@/app/actions/support/createTicket";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function openSupportChat() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-support-bot"));
  }
}

export function SupportBotButton({
  className,
  variant = "outline",
}: {
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
}) {
  return (
    <Button
      type="button"
      variant={variant}
      onClick={() => openSupportChat()}
      className={cn("flex items-center gap-2", className)}
    >
      <svg className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="11" width="18" height="10" rx="3" />
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v4" />
        <line x1="8" y1="16" x2="8.01" y2="16" strokeWidth={3} />
        <line x1="16" y1="16" x2="16.01" y2="16" strokeWidth={3} />
      </svg>
      <span>Suporte & Atendimento</span>
    </Button>
  );
}

interface Message {
  id: string;
  sender: "bot" | "user";
  text: string;
  attachment?: string;
  time: string;
}

const OPCOES_RAPIDAS = [
  "⚡ Ativar Plano PRO",
  "📱 Conectar WhatsApp Oficial",
  "🐞 Encontrei um bug / erro",
  "🙋 Falar com suporte humano",
];

export function SupportBotWidget() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleOpen() {
      setOpen(true);
    }
    window.addEventListener("open-support-bot", handleOpen);
    return () => window.removeEventListener("open-support-bot", handleOpen);
  }, []);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial-1",
      sender: "bot",
      text: "Olá, tudo bem? Iremos atender você, só um minuto... Mas antes, me diga: qual suporte você precisa?",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [ticketCreated, setTicketCreated] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("O print deve ter no máximo 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFile(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function sendMessage(textToSend?: string) {
    const text = (textToSend ?? inputValue).trim();
    if (!text && !selectedFile) return;

    const userMsg: Message = {
      id: String(Date.now()),
      sender: "user",
      text: text || "Enviei um print em anexo.",
      attachment: selectedFile ?? undefined,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    const filePayload = selectedFile;
    setSelectedFile(null);

    startTransition(async () => {
      const res = await createTicket({
        mensagem: text,
        categoria: text.startsWith("⚡") ? "plano_pro" : text.startsWith("📱") ? "whatsapp" : "suporte_geral",
        printDataUrl: filePayload ?? undefined,
      });

      if (res && res.ok && res.ticketId) {
        setTicketCreated(res.ticketId);
        const botReply: Message = {
          id: String(Date.now() + 1),
          sender: "bot",
          text: `Perfeito! Registrei seu chamado #${res.ticketId}. Nossa equipe técnica e de suporte já foi notificada e vai te atender em instantes.`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, botReply]);
      } else {
        toast.error("Falha ao registrar chamado. Tente novamente.");
      }
    });
  }

  return (
    <>
      {/* Botão Flutuante Redondo no Canto Direito - apenas Desktop */}
      <div className="fixed bottom-5 right-5 z-40 hidden md:block">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl focus:outline-none"
          aria-label="Abrir suporte e atendimento"
        >
          {open ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <div className="relative flex items-center justify-center">
              {/* Ícone de Bot Inteligente */}
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="11" width="18" height="10" rx="3" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4" />
                <line x1="8" y1="16" x2="8.01" y2="16" strokeWidth={3} />
                <line x1="16" y1="16" x2="16.01" y2="16" strokeWidth={3} />
              </svg>
              {/* Ponto indicador de online */}
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white"></span>
              </span>
            </div>
          )}
        </button>
      </div>

      {/* Janela de Chat Flutuante */}
      {open && (
        <div className="fixed bottom-4 right-4 md:bottom-22 md:right-5 z-50 flex h-[520px] w-[calc(100vw-2rem)] md:w-[370px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header do Chat */}
          <div className="flex items-center justify-between border-b bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="11" width="18" height="10" rx="3" />
                  <circle cx="12" cy="5" r="2" />
                  <path d="M12 7v4" />
                  <line x1="8" y1="16" x2="8.01" y2="16" strokeWidth={3} />
                  <line x1="16" y1="16" x2="16.01" y2="16" strokeWidth={3} />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold">Tecla Bot Suporte</h4>
                <p className="flex items-center gap-1.5 text-[11px] text-blue-100">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400"></span>
                  Online • Triagem automática
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Área de Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs bg-muted/20">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${
                    msg.sender === "user"
                      ? "bg-blue-600 text-white rounded-br-none"
                      : "bg-card border text-card-foreground rounded-bl-none"
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  {msg.attachment && (
                    <div className="mt-2 overflow-hidden rounded-lg border border-white/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={msg.attachment} alt="Anexo do chamado" className="max-h-40 w-full object-cover" />
                    </div>
                  )}
                </div>
                <span className="mt-1 text-[10px] text-muted-foreground px-1">{msg.time}</span>
              </div>
            ))}

            {/* Opções de clique rápido se só tiver a mensagem inicial */}
            {messages.length === 1 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] font-medium text-muted-foreground">Escolha uma opção ou digite abaixo:</p>
                <div className="flex flex-col gap-1.5">
                  {OPCOES_RAPIDAS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => sendMessage(opt)}
                      className="rounded-xl border bg-card px-3 py-2 text-left font-medium text-foreground transition-all hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/30"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Notificação de chamado criado com botão de WhatsApp direto */}
            {ticketCreated && (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-center dark:border-emerald-900/50 dark:bg-emerald-950/30">
                <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                  Chamado aberto! Precisa de resposta urgente?
                </p>
                <a
                  href={`https://wa.me/5521967757228?text=Olá, abri o chamado ${ticketCreated} no Tecla CRM e preciso de suporte.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Avisar no WhatsApp
                </a>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Preview de imagem anexada */}
          {selectedFile && (
            <div className="relative flex items-center gap-2 border-t bg-muted/40 p-2 text-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedFile} alt="Preview" className="h-10 w-10 rounded border object-cover" />
              <span className="flex-1 truncate text-muted-foreground">Print selecionado</span>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="rounded p-1 text-destructive hover:bg-destructive/10"
              >
                ✕
              </button>
            </div>
          )}

          {/* Input e Envio */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex items-center gap-1.5 border-t bg-background p-2.5"
          >
            {/* Input escondido para print */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Anexar print ou imagem"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </button>

            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Digite sua dúvida ou problema..."
              className="h-9 text-xs"
              disabled={isPending}
            />

            <Button
              type="submit"
              size="sm"
              disabled={isPending || (!inputValue.trim() && !selectedFile)}
              className="h-9 px-3 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isPending ? "..." : "Enviar"}
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
