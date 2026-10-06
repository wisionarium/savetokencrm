"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/hooks/i18n/useT";

import { Button } from "@/components/ui/button";
import { Microphone, PaperPlaneTilt, Trash } from "@/lib/ui/icons";
import { useSendMessage } from "@/hooks/inbox/useSendMessage";
import { useUploadMedia } from "@/hooks/inbox/useUploadMedia";

const OGG_MIME = "audio/ogg;codecs=opus";
const WEBM_MIME = "audio/webm;codecs=opus";

/** O que o navegador sabe gravar sozinho, em ordem de preferência. */
function nativeMime(): string | undefined {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return undefined;
  // OGG primeiro: é o que o canal oficial aceita como nota de voz, então o
  // arquivo já sai pronto e o servidor não precisa converter nada.
  if (MediaRecorder.isTypeSupported(OGG_MIME)) return OGG_MIME;
  if (MediaRecorder.isTypeSupported(WEBM_MIME)) return WEBM_MIME;
  return undefined;
}

interface Props {
  conversationId: string;
  disabled?: boolean;
  /** Avisa quando a gravação começa/termina — o thread mostra "gravando áudio…". */
  onRecordingChange?: (gravando: boolean) => void;
}

/**
 * O mínimo que o gravador usa, nativo ou polyfill: os dois falam a mesma
 * língua (start/stop/ondataavailable/onstop/mimeType/state), então um tipo
 * só serve aos dois sem importar tipo de ninguém.
 */
interface GravadorDeVoz {
  readonly mimeType: string;
  readonly state: RecordingState;
  ondataavailable: ((e: BlobEvent) => void) | null;
  onstop: (() => void) | null;
  start(): void;
  stop(): void;
}

/** Gravação de voz estilo WhatsApp: mic → timer + cancelar/enviar → PTT. */
export function AudioRecorder({ conversationId, disabled, onRecordingChange }: Props) {
  const t = useT();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<GravadorDeVoz | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardRef = useRef(false);
  const startingRef = useRef(false);
  const upload = useUploadMedia();
  const send = useSendMessage();

  // O thread mostra "gravando áudio…" enquanto grava — via prop, não via
  // estado global: só o composer sabe que ESTE gravador está ligado.
  useEffect(() => {
    onRecordingChange?.(recording);
  }, [recording, onRecordingChange]);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  };

  // Trocar de conversa/rota no meio de uma gravação não pode deixar o mic aberto.
  useEffect(
    () => () => {
      discardRef.current = true;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      cleanupStream();
    },
    [],
  );

  async function start() {
    if (startingRef.current || recording) return;
    startingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = nativeMime();
      // Sem ogg nativo (Chrome, Safari): codificador Ogg Opus em WASM, que
      // grava `audio/ogg` direto no navegador. Sem ele o arquivo sairia em
      // webm e o canal oficial recusaria depois de aceitar (131053) — e no
      // plano gratuito não há servidor com conversor para salvar depois.
      // Carregado só quando precisa: quem tem ogg nativo nem baixa o WASM.
      const rec: GravadorDeVoz =
        mime === OGG_MIME || mime === undefined
          ? (new MediaRecorder(
              stream,
              mime ? { mimeType: mime } : undefined,
            ) as unknown as GravadorDeVoz)
          : await (async (): Promise<GravadorDeVoz> => {
              const { default: OpusMediaRecorder } = await import("opus-media-recorder");
              return new OpusMediaRecorder(
                stream,
                { mimeType: OGG_MIME },
                {
                  encoderWorkerFactory: () =>
                    new Worker("/vendor/opus-media-recorder/encoderWorker.umd.js"),
                  OggOpusEncoderWasmPath: "/vendor/opus-media-recorder/OggOpusEncoder.wasm",
                },
              );
            })();
      chunksRef.current = [];
      discardRef.current = false;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        cleanupStream();
        setRecording(false);
        setElapsed(0);
        if (discardRef.current || chunksRef.current.length === 0) return;
        const type = rec.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        void upload
          .mutateAsync({ conversationId, file: blob, filename: `ptt.${type.includes("ogg") ? "ogg" : "webm"}` })
          .then((uploaded) =>
            send.mutate(
              {
                conversation_id: conversationId,
                type: "audio",
                media_storage_path: uploaded.storage_path,
                media_mime: uploaded.media_mime,
                media_size_bytes: uploaded.media_size_bytes,
              },
              {},
            ),
          )
          .catch(() => {
            // toast já disparado pelo onError de useUploadMedia
          });
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      cleanupStream();
      // permissão negada / sem mic — não gravar é o estado final; toast simples
      const { showApiError } = await import("@/components/feedback/ApiErrorToast");
      showApiError(new Error(t("Não consegui acessar o microfone. Verifique a permissão do navegador.")));
    } finally {
      startingRef.current = false;
    }
  }

  function stopIfRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (!recording) {
    return (
      <Button
        type="button"
        size="icon"
        className="h-9 w-9 shrink-0"
        aria-label={t("Gravar áudio")}
        onClick={start}
        disabled={disabled}
      >
        <Microphone size={16} weight="fill" aria-hidden />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-9 w-9 shrink-0 text-destructive"
        aria-label={t("Cancelar gravação")}
        onClick={() => {
          discardRef.current = true;
          stopIfRecording();
        }}
      >
        <Trash size={16} weight="regular" aria-hidden />
      </Button>
      <span className="flex items-center gap-1.5 text-sm tabular-nums text-destructive">
        <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" aria-hidden />
        {fmt(elapsed)}
      </span>
      <Button
        type="button"
        size="icon"
        className="h-9 w-9 shrink-0"
        aria-label={t("Enviar áudio")}
        onClick={stopIfRecording}
      >
        <PaperPlaneTilt size={16} weight="fill" aria-hidden />
      </Button>
    </div>
  );
}
