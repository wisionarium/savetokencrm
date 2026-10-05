/**
 * O TRANSPORTE DE WHATSAPP DESTA INSTALACAO ESTA DE PE?
 *
 * Pergunta de INSTALACAO, nao de canal: Meta Cloud/Zernio configurados?
 * (Antes lia WAHA_API_BASE_URL/KEY do `.env`; WAHA removido na migracao
 * Vercel + Supabase Cloud.)
 */

/** Ambiente injetavel — mesma forma que `lib/instalacao/ambiente.ts` usa. */
export type FonteDeAmbiente = Record<string, string | undefined>;

export interface TransporteDeWhatsapp {
  /** O endereco do servico esta configurado? */
  apontado: boolean;
  /** E a chave dele? */
  comChave: boolean;
}

function preenchida(src: FonteDeAmbiente, nome: string): boolean {
  return (src[nome] ?? "").trim() !== "";
}

export function lerTransporteDeWhatsapp(src: FonteDeAmbiente): TransporteDeWhatsapp {
  const oficial =
    preenchida(src, "META_WABA_ID") ||
    preenchida(src, "META_PHONE_NUMBER_ID") ||
    preenchida(src, "META_SYSTEM_USER_TOKEN");
  const parceiro = preenchida(src, "ZERNIO_API_KEY") || preenchida(src, "ZERNIO_API_BASE_URL");
  // Compat: instalacao antiga ainda pode ter as chaves WAHA no `.env`.
  const legado = preenchida(src, "WAHA_API_BASE_URL") && preenchida(src, "WAHA_API_KEY");
  const apontado = oficial || parceiro || legado;
  return { apontado, comChave: apontado };
}
