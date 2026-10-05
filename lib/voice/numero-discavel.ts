/**
 * O NÃšMERO QUE A LIGAÃ‡ÃƒO DISCA Ã‰ O QUE O WHATSAPP REGISTROU, NÃƒO O DO CADASTRO.
 *
 * Medido na VPS em 2026-09-15: o contato `+5531998966398` foi discado como
 * `5531998966398@s.whatsapp.net`. O WhatsApp registra esse celular como
 * `553198966398` â€” sem o nono dÃ­gito, o caso comum em DDD fora de SÃ£o Paulo â€”,
 * e o canal de mensagens da organizaÃ§Ã£o confirmou (as duas grafias responderam
 * `553198966398@c.us`). O serviÃ§o de voz nÃ£o pergunta nada a ninguÃ©m: monta o
 * destino com `types.NewJID(dÃ­gitos, DefaultUserServer)`. A oferta saiu para um
 * endereÃ§o que nÃ£o existe, o painel ficou em "Chamandoâ€¦" e a ligaÃ§Ã£o expirou
 * sem que telefone nenhum tocasse.
 *
 * O CRM guarda o celular brasileiro COM o nono dÃ­gito, de propÃ³sito
 * (`lib/channels/phone-variants.ts`), e o envio de mensagem jÃ¡ pergunta ao
 * canal qual grafia existe. A ligaÃ§Ã£o faz o mesmo, pela porta do canal
 * (`ChannelAdapter.resolveRegisteredPhone`): percorre as sessÃµes de mensagem em
 * pÃ© da organizaÃ§Ã£o e pergunta a quem souber responder. Qual plataforma
 * responde Ã© assunto de `lib/channels/`, nÃ£o daqui â€” o `lint:channels` reprova
 * este arquivo se ele nomear uma.
 *
 * Falha ABERTA: sem sessÃ£o de mensagens em pÃ©, canal que nÃ£o sabe responder, sÃ³
 * identidade opaca, consulta que falha ou que passa do prazo â€” disca o nÃºmero
 * do cadastro, exatamente o comportamento anterior. Recusar aqui trocaria "Ã s
 * vezes nÃ£o toca" por "nunca liga".
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CHANNEL_SESSION_REF_COLUMNS,
  PROVIDERS_DE_MENSAGEM,
  getAdapter,
  resolveSessionRef,
  type ChannelAdapter,
  type ChannelProvider,
  type ChannelSessionRef,
} from "@/lib/channels";

/**
 * Quanto a ligaÃ§Ã£o espera o canal responder antes de discar o cadastro.
 *
 * Cada consulta tem teto de 15 s no cliente do transporte e sÃ£o atÃ© duas grafias
 * em sÃ©rie: com o canal aceitando conexÃ£o e sem responder, a rota passava dos
 * 30 s em que o navegador desiste de uma escrita (`MUTATION_TIMEOUT_MS`). A tela
 * mostrava erro, o botÃ£o seguia livre para outro clique, e a ligaÃ§Ã£o saÃ­a mesmo
 * assim ~31 s depois â€” uma por clique. Numa resposta normal a consulta volta em
 * dezenas de milissegundos; 4 s Ã© folga, nÃ£o estimativa.
 */
export const PRAZO_DA_CONSULTA_MS = 4_000;

export interface NumeroDiscavel {
  /** SÃ³ dÃ­gitos, sem `+` â€” a forma que `POST /api/sessions/{sid}/calls` recebe. */
  digitos: string;
  /** `whatsapp` = confirmado pelo canal; `cadastro` = fallback sem confirmaÃ§Ã£o. */
  fonte: "whatsapp" | "cadastro";
}

export async function resolverNumeroDiscavel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  organizationId: string,
  telefone: string,
  deps: { adapterDe?: (provider: string) => ChannelAdapter; prazoMs?: number } = {},
): Promise<NumeroDiscavel> {
  const doCadastro: NumeroDiscavel = { digitos: telefone.replace(/\D/g, ""), fonte: "cadastro" };
  const adapterDe = deps.adapterDe ?? getAdapter;

  const { data } = await supabase
    .from("channel_sessions")
    .select(CHANNEL_SESSION_REF_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("status", "WORKING")
    .is("archived_at", null)
    .in("provider", [...PROVIDERS_DE_MENSAGEM])
    .limit(10);
  const sessoes = (data ?? []) as ChannelSessionRef[];
  if (sessoes.length === 0) return doCadastro;

  // Qualquer sessÃ£o que saiba responder serve: a pergunta Ã© ao diretÃ³rio da
  // plataforma, e a resposta nÃ£o depende de qual conta perguntou.
  const procurar = async (): Promise<string | null> => {
    for (const sessao of sessoes) {
      let adapter: ChannelAdapter;
      try {
        adapter = adapterDe(sessao.provider);
      } catch {
        continue;
      }
      if (!adapter.resolveRegisteredPhone || !adapter.isConfigured()) continue;
      const sessionRef = resolveSessionRef(sessao);
      if (!sessionRef) continue;
      const digitos = await adapter
        .resolveRegisteredPhone({ organizationId, sessionRef, phone: telefone })
        .catch(() => null);
      if (digitos) return digitos;
    }
    return null;
  };

  // A consulta que estoura o prazo segue em segundo plano e Ã© descartada: Ã©
  // leitura, nÃ£o tem efeito a desfazer.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), deps.prazoMs ?? PRAZO_DA_CONSULTA_MS);
  });
  try {
    const digitos = await Promise.race([procurar(), prazo]);
    return digitos ? { digitos, fonte: "whatsapp" } : doCadastro;
  } finally {
    clearTimeout(timer);
  }
}
