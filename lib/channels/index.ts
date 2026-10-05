/**
 * A porta de entrada do seam. Feature nenhuma importa adapter direto —
 * pede o adapter do provider da conversa e o descritor de capabilities.
 * WAHA removido: só Meta Cloud + Zernio (Vercel + Supabase Cloud).
 */
import { metaCloudAdapter } from "./adapters/meta-cloud";
import { zernioAdapter } from "./adapters/zernio";
import type { ChannelAdapter, ProviderDeMensagem } from "./types";

/**
 * Um adapter por provider de MENSAGEM. `wacalls` não entra: ele não endereça
 * destinatário nem envia envelope — ver `ProviderDeMensagem` em `./types`.
 */
const ADAPTERS: Record<ProviderDeMensagem, ChannelAdapter | null> = {
  meta_cloud: metaCloudAdapter,
  zernio: zernioAdapter,
};

/**
 * Fail-closed: provider sem adapter (ou fora da matriz) lança em vez de cair
 * num default. Enviar pelo canal errado é pior que não enviar.
 */
export function getAdapter(provider: string): ChannelAdapter {
  const adapter = ADAPTERS[provider as ProviderDeMensagem];
  if (!adapter) throw new Error(`unknown_channel_provider: ${provider}`);
  return adapter;
}

export {
  capabilitiesOf,
  CHANNEL_CAPABILITIES,
  DEFAULT_CHANNEL_PROVIDER,
  PROVIDERS_DE_MENSAGEM,
  PROVIDERS_SEM_MENSAGEM,
  canalConhecidoSemMensagem,
  transportaMensagem,
} from "./capabilities";
export { CHANNEL_SESSION_REF_COLUMNS, resolveSessionRef } from "./session-ref";
export type { ChannelSessionRef } from "./session-ref";
export type {
  ChannelAdapter,
  ChannelCapabilities,
  ChannelProvider,
  ProviderDeMensagem,
  OutboundEnvelope,
  OutboundKind,
  OutboundMedia,
  RecipientInput,
} from "./types";
