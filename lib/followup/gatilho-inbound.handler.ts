/**
 * Adapter que pluga `aplicaGatilhoInbound` (lib/followup/gatilho-inbound.ts)
 * no dispatcher genérico do `event_log`.
 *
 * Consome `message.received` e dispara automações estilo ManyChat configuradas
 * com gatilho `first_message` (boas-vindas) ou `keyword` (palavras-chave).
 */
import type { EventHandler, HandlerResult } from "@/lib/event-log/dispatcher";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseFollowupGateDb } from "@/lib/followup/agent-followup-gate";
import { aplicarTextoNosFollowups, textoDoPayloadInbound } from "@/lib/followup/aplicar-inbound";
import {
  EVENTO_DE_INBOUND,
  aplicaGatilhoInbound,
  createSupabaseGatilhoInboundDb,
} from "@/lib/followup/gatilho-inbound";

export const FOLLOWUP_GATILHO_INBOUND_HANDLER_KEY = "followup-gatilho-inbound.v1";

export const followupGatilhoInboundHandler: EventHandler = {
  key: FOLLOWUP_GATILHO_INBOUND_HANDLER_KEY,
  events: [EVENTO_DE_INBOUND],
  async handle(row): Promise<HandlerResult> {
    try {
      const admin = createAdminClient();
      const summary = await aplicaGatilhoInbound(
        {
          db: createSupabaseGatilhoInboundDb(admin),
          gateDb: createSupabaseFollowupGateDb(admin),
          clock: () => new Date(),
        },
        row,
      );
      if (summary.enrolled > 0) {
        const contactId = typeof row.payload.contact_id === "string" ? row.payload.contact_id : null;
        if (contactId) {
          try {
            await aplicarTextoNosFollowups(admin, {
              organizationId: row.organization_id,
              contactId,
              texto: textoDoPayloadInbound(row.payload) || null,
            });
          } catch {
            // falha em avançar inline não invalida o enrollment gravado
          }
        }
      }

      return {
        consumer_key: FOLLOWUP_GATILHO_INBOUND_HANDLER_KEY,
        status: summary.matched && summary.enrolled > 0 ? "ok" : "skipped",
        detail:
          `armados=${summary.pointers_armados} enrolled=${summary.enrolled} ` +
          `origem_obsoleta=${summary.skipped_stale_origin ?? 0} ja_vivo=${summary.skipped_existing} ` +
          `bloqueado=${summary.skipped_blocked ?? 0}`,
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return { consumer_key: FOLLOWUP_GATILHO_INBOUND_HANDLER_KEY, status: "error", detail };
    }
  },
};
