"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/browser";
import {
  dobrarAviso,
  EVENTO_DE_DIGITACAO,
  montarAvisoDeDigitacao,
  semExpirados,
  topicoDeDigitacao,
  type AvisoDeDigitacao,
  type TipoDeDigitacao,
} from "@/lib/inbox/digitacao";

/**
 * Digitação alheia no thread + aviso da própria — o fio do indicador do CRM.
 *
 * Um hook só para os dois lados porque os dois precisam do MESMO tópico
 * (`digitacao:<conversationId>`, sem sufixo de instância): emissor e ouvinte
 * em tópicos diferentes é silêncio nos dois sentidos, sem erro nenhum.
 *
 * Fail-silent por desenho: socket caído ou broadcast bloqueado no projeto =
 * sem indicador, e só isso. A mensagem continua chegando pelo
 * `postgres_changes` — ver `lib/inbox/digitacao.ts`.
 */
export function useDigitacao(
  conversationId: string | null,
  eu: { userId: string | null; nome: string | null },
) {
  const [digitadores, setDigitadores] = useState<AvisoDeDigitacao[]>([]);
  const canalRef = useRef<RealtimeChannel | null>(null);
  const assinadoRef = useRef(false);
  const ultimoAvisoRef = useRef(0);
  const euRef = useRef(eu);
  useEffect(() => {
    euRef.current = eu;
  });

  // Troca de conversa larga os avisos da outra — ajustado no render (padrão
  // "adjust state during render"), não em efeito: `setState` em efeito é o que
  // o lint `react-hooks/set-state-in-effect` recusa, com razão (cascata).
  const [convAtual, setConvAtual] = useState(conversationId);
  if (convAtual !== conversationId) {
    setConvAtual(conversationId);
    setDigitadores([]);
    ultimoAvisoRef.current = 0;
  }

  useEffect(() => {
    if (!conversationId) return;
    const supabase = createClient();
    const canal = supabase.channel(topicoDeDigitacao(conversationId), {
      config: { broadcast: { self: false } },
    });
    canalRef.current = canal;
    canal
      .on("broadcast", { event: EVENTO_DE_DIGITACAO }, ({ payload }: { payload: unknown }) => {
        const p = payload as Partial<AvisoDeDigitacao> | null;
        if (!p || typeof p.user_id !== "string" || typeof p.nome !== "string") return;
        if (p.user_id === euRef.current.userId) return;
        const kind: TipoDeDigitacao = p.kind === "audio" || p.kind === "file" ? p.kind : "text";
        setDigitadores((atual) =>
          semExpirados(
            dobrarAviso(atual, { user_id: p.user_id as string, nome: p.nome as string, kind, ts: Date.now() }),
            Date.now(),
          ),
        );
      })
      .subscribe((estado: string) => {
        assinadoRef.current = estado === "SUBSCRIBED";
      });

    // Varredura do vencimento: sem ela, um aviso sem refresco grudaria.
    const varredura = setInterval(() => {
      setDigitadores((atual) => {
        const vivos = semExpirados(atual, Date.now());
        return vivos.length === atual.length ? atual : vivos;
      });
    }, 2000);

    return () => {
      clearInterval(varredura);
      assinadoRef.current = false;
      const c = canalRef.current;
      canalRef.current = null;
      if (c) void supabase.removeChannel(c).catch(() => {});
    };
  }, [conversationId]);

  /**
   * "Estou digitando" — throttled em ~2,5s por chamador. O chamador decide
   * QUANDO (texto não vazio, gravando áudio, arquivo em preview); aqui só se
   * decide a cadência. Sem nome ou sem assinatura = silêncio.
   */
  const avisar = useCallback(
    (kind: TipoDeDigitacao) => {
      const agora = Date.now();
      if (agora - ultimoAvisoRef.current < 2500) return;
      const { userId, nome } = euRef.current;
      const canal = canalRef.current;
      if (!userId || !nome || !canal || !assinadoRef.current) return;
      ultimoAvisoRef.current = agora;
      void canal
        .send({
          type: "broadcast",
          event: EVENTO_DE_DIGITACAO,
          payload: montarAvisoDeDigitacao(userId, nome, kind, agora),
        })
        .catch(() => {});
    },
    [],
  );

  return { digitadores, avisar };
}
