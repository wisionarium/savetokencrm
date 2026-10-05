import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export const pairingPhoneSchema = z
  .string()
  .trim()
  .max(32)
  .regex(/^\+?[\d\s()-]+$/)
  .transform((value) => value.replace(/\D/g, ""))
  .pipe(z.string().regex(/^[1-9]\d{7,14}$/));

export class PairingCodeError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/**
 * Pareamento por codigo — indisponivel sem o transporte WAHA.
 * Meta Cloud/Zernio conectam por OAuth/painel do provider, nao por QR/codigo
 * neste-CRM. Mantido para a rota responder 422 em vez de 500.
 */
export async function requestChannelPairingCode(
  _db: SupabaseClient,
  _organizationId: string,
  _channelId: string,
  _phoneNumber: string,
): Promise<{ code: string }> {
  throw new PairingCodeError(
    "pairing_not_supported",
    "Este canal nao conecta por codigo de pareamento. Conecte pela conta oficial (Meta) ou pelo parceiro (Zernio).",
    422,
  );
}
