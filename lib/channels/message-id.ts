/**
 * IDs externos de mensagem — neutro de provider.
 *
 * Extraido de `lib/waha/message-id.ts` na remocao WAHA/VPS (Vercel + Supabase
 * Cloud). A Meta Cloud devolve `wamid` plano; o NOWEB compoe
 * `{fromMe}_{chatId}_{bare}`. As funcoes abaixo cobrem os dois formatos para
 * que ack/eco continuem casando sem duplicata.
 */

export function parseProviderMessageId(raw: unknown): string | null {
  if (typeof raw === "string") return raw;
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as { id?: unknown; key?: { id?: unknown }; wamid?: unknown };
  if (typeof r.wamid === "string") return r.wamid;
  if (typeof r.id === "string") return r.id;
  if (typeof r.id === "object" && r.id !== null) {
    const serialized = (r.id as { _serialized?: unknown })._serialized;
    if (typeof serialized === "string") return serialized;
    const innerId = (r.id as { id?: unknown }).id;
    if (typeof innerId === "string") return innerId;
  }
  if (typeof r.key === "object" && r.key !== null && typeof r.key.id === "string") return r.key.id;
  return null;
}

export function bareMessageId(id: string): string {
  const cut = id.lastIndexOf("_");
  return cut === -1 ? id : id.slice(cut + 1);
}

export function providerEchoExternalIds(externalId: string, recipient: string): string[] {
  const bare = bareMessageId(externalId);
  return [...new Set([externalId, bare, `true_${recipient}_${bare}`])];
}

export function chatIdFromProviderMessageId(id: string): string | null {
  const first = id.indexOf("_");
  const last = id.lastIndexOf("_");
  if (first === -1 || last === first) return null;
  const chat = id.slice(first + 1, last);
  return chat.includes("@") ? chat : null;
}

// Aliases de compatibilidade com o nome antigo (remover quando os call sites migrarem).
export {
  parseProviderMessageId as parseWahaMessageId,
  bareMessageId as bareWaMessageId,
  providerEchoExternalIds as wahaEchoExternalIds,
  chatIdFromProviderMessageId as chatIdFromWaMessageId,
};
