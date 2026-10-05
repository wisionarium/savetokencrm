/**
 * Adapter generico via CRM — envolve (nao reescreve) o sink idempotente
 * (send-message.ts) e o espelho de saude do watchdog (session-watchdog.ts).
 * Substitui o adapter legado do transporte removido: o sink do CRM ja e
 * agnostico de canal (resolve o provider por conversa), entao o corpo e identico.
 */
import type pg from "pg";

import type {
  ChannelAdapter,
  ChannelCapabilities,
  ChannelCost,
  ChannelSendInput,
  ChannelSendResult,
  ChannelSessionHealth,
} from "../../channel-adapter";

import { sinalizarDigitando } from "@/lib/messaging/presenca";

import { CrmTransportError, type CrmEdgeConfig } from "../crm/mcp-client";
import { sendTurnMessage, SendToolError } from "../crm/send-message";
import { SESSION_HEALTHY_STATUS } from "../crm/session-watchdog";

/** id do canal generico — o unico adapter do motor. */
export const GENERIC_VIA_CRM_CHANNEL = "generic_via_crm";

export class GenericChannelAdapter implements ChannelAdapter {
  readonly channel = GENERIC_VIA_CRM_CHANNEL;
  private readonly db: pg.Pool;
  private readonly crmCfg: CrmEdgeConfig;

  constructor(db: pg.Pool, crmCfg: CrmEdgeConfig) {
    this.db = db;
    this.crmCfg = crmCfg;
  }

  async send(input: ChannelSendInput): Promise<ChannelSendResult> {
    try {
      const outcome = await sendTurnMessage(this.db, this.crmCfg, input);
      switch (outcome.kind) {
        case "sent":
          return { kind: "sent", idempotencyKey: outcome.idempotencyKey, messageId: outcome.crmMessageId };
        case "already_sent":
          return { kind: "already_sent", idempotencyKey: outcome.idempotencyKey, messageId: outcome.crmMessageId };
        case "queued":
          return { kind: "queued", idempotencyKey: outcome.idempotencyKey, messageId: outcome.crmMessageId };
        case "blocked":
          return { kind: "blocked", idempotencyKey: outcome.idempotencyKey };
        case "failed":
          return { kind: "failed", idempotencyKey: outcome.idempotencyKey, messageId: outcome.crmMessageId };
      }
    } catch (err) {
      if (err instanceof CrmTransportError || err instanceof SendToolError) {
        return { kind: "unavailable", reason: err.name };
      }
      throw err;
    }
  }

  async signalTyping(input: { tenantId: string; conversationId: string }): Promise<void> {
    await sinalizarDigitando(this.crmCfg.supabase, {
      organizationId: input.tenantId,
      conversationId: input.conversationId,
    });
  }

  async sessionHealth(channelSessionId: string): Promise<ChannelSessionHealth> {
    const { rows } = await this.db.query<{ status: string; changed_at: string | null }>(
      `select status, status_changed_at::text as changed_at
       from channel_session_health where channel_session_id = $1`,
      [channelSessionId],
    );
    const row = rows[0];
    if (row === undefined) {
      return { healthy: false, status: "unknown", since: null };
    }
    return {
      healthy: row.status === SESSION_HEALTHY_STATUS,
      status: row.status,
      since: row.changed_at ? new Date(row.changed_at).getTime() : null,
    };
  }

  capabilities(): ChannelCapabilities {
    // Canais com janela de 24h: template aprovado fora dela.
    return { freeformAnytime: false, serviceWindowHours: 24 };
  }

  costPerMessage(): ChannelCost {
    return { perMessageUsdCents: 0, model: "flat" };
  }
}
