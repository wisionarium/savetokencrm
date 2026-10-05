/**
 * Mídia de saída neutra de provider — movida de `lib/waha/media-send.ts`
 * na remoção WAHA/VPS (Vercel + Supabase Cloud). Mesmos 4 campos.
 */
export interface OutboundMedia {
  url: string;
  mime: string;
  filename?: string | null;
  caption?: string | null;
}
