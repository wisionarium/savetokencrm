import type { SupabaseClient } from "@supabase/supabase-js";

import type { EventRow } from "@/lib/event-log/dispatcher";
import { flowGraphSchema } from "./graph-schema";
import { triggerConfigSchema } from "./api-schemas";
import { resolveAgentForAutomaticTrigger, type FollowupGateDb } from "./agent-followup-gate";
import { serviceForEvent, beginServiceAtOrigin } from "@/lib/atendimento/origem";
import type { ServiceBoundary } from "@/lib/atendimento/fronteira";

export const EVENTO_DE_INBOUND = "message.received";

export type InboundTriggerKind = "first_message" | "keyword";

export interface PointerDeInbound {
  id: string;
  organization_id: string;
  active_version_id: string;
  kind: InboundTriggerKind;
  params: {
    scope?: "contact" | "conversation";
    keywords?: string[];
  };
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Casa texto da mensagem com a lista de palavras-chave configuradas.
 * Insensível a maiúsculas/minúsculas e acentos (ex: "olá" casa "ola", "quero" casa "QUERO!").
 * Suporta frases (com espaço) e palavras avulsas com fronteira de palavra.
 */
export function casaPalavraChave(texto: string, keywords: string[]): string | null {
  if (!texto || !Array.isArray(keywords) || keywords.length === 0) return null;
  const normaliza = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const msgNorm = normaliza(texto);
  if (!msgNorm) return null;

  for (const rawKw of keywords) {
    if (typeof rawKw !== "string") continue;
    const kwNorm = normaliza(rawKw);
    if (!kwNorm) continue;

    if (kwNorm.includes(" ")) {
      if (msgNorm.includes(kwNorm)) return rawKw;
    } else {
      if (msgNorm === kwNorm) return rawKw;
      const regex = new RegExp(`(^|[^a-z0-9])${escapeRegex(kwNorm)}($|[^a-z0-9])`, "i");
      if (regex.test(msgNorm)) return rawKw;
    }
  }
  return null;
}

export interface GatilhoInboundDb {
  carregaPointersDeInbound(orgId: string): Promise<PointerDeInbound[]>;
  carregaDadosDaMensagem(
    orgId: string,
    messageId: string,
  ): Promise<{ contact_id: string | null; conversation_id: string | null; body: string | null }>;
  carregaContatoBloqueado(orgId: string, contactId: string): Promise<boolean>;
  contaMensagensInbound(
    orgId: string,
    contactId: string,
    conversationId: string,
  ): Promise<{ totalContato: number; totalConversa: number }>;
  jaTeveEnrollment(orgId: string, pointerId: string, contactId: string): Promise<boolean>;
  carregaNoDeGatilho(orgId: string, versionId: string): Promise<string | null>;
  insereEnrollment(input: {
    event_id?: string;
    organization_id: string;
    pointer_id: string;
    version_id: string;
    contact_id: string;
    conversation_id: string;
    current_node_id: string;
    agent_id: string | null;
  }): Promise<{ inserted: boolean; id: string | null; reason?: "stale_origin" | "already_live" }>;
  insereEventoDoEnrollment(evento: {
    organization_id: string;
    enrollment_id: string;
    node_id: string;
    event_type: string;
    payload: Record<string, unknown>;
    idempotency_key: string;
  }): Promise<void>;
}

export interface GatilhoInboundSummary {
  matched: boolean;
  pointers_armados: number;
  enrolled: number;
  skipped_existing: number;
  skipped_stale_origin?: number;
  skipped_blocked?: number;
}

export interface GatilhoInboundDeps {
  db: GatilhoInboundDb;
  gateDb: FollowupGateDb;
  clock: () => Date;
}

function vazio(): GatilhoInboundSummary {
  return {
    matched: false,
    pointers_armados: 0,
    enrolled: 0,
    skipped_existing: 0,
    skipped_stale_origin: 0,
    skipped_blocked: 0,
  };
}

export async function aplicaGatilhoInbound(
  deps: GatilhoInboundDeps,
  row: EventRow,
): Promise<GatilhoInboundSummary> {
  const summary = vazio();
  if (row.event_type !== EVENTO_DE_INBOUND) return summary;

  let contactId = typeof row.payload.contact_id === "string" ? row.payload.contact_id : null;
  let conversationId = typeof row.payload.conversation_id === "string" ? row.payload.conversation_id : null;
  const messageId =
    (typeof row.payload.message_id === "string" ? row.payload.message_id : null) ??
    (row.entity_kind === "message" ? row.entity_id : null);

  let body =
    typeof row.payload.body === "string"
      ? row.payload.body
      : typeof row.payload.body_preview === "string"
        ? row.payload.body_preview
        : null;

  if ((!contactId || !conversationId || body === null) && messageId) {
    const dadosMsg = await deps.db.carregaDadosDaMensagem(row.organization_id, messageId);
    contactId = contactId ?? dadosMsg.contact_id;
    conversationId = conversationId ?? dadosMsg.conversation_id;
    body = body ?? dadosMsg.body;
  }

  if (!contactId || !conversationId) return summary;

  const isBlocked = await deps.db.carregaContatoBloqueado(row.organization_id, contactId);
  if (isBlocked) {
    summary.skipped_blocked = 1;
    return summary;
  }

  const armados = await deps.db.carregaPointersDeInbound(row.organization_id);
  summary.pointers_armados = armados.length;
  if (armados.length === 0) return summary;

  const texto = (body ?? "").trim();
  let counts: { totalContato: number; totalConversa: number } | null = null;

  for (const pointer of armados) {
    let matchedKw: string | null = null;

    if (pointer.kind === "first_message") {
      if (!counts) {
        counts = await deps.db.contaMensagensInbound(row.organization_id, contactId, conversationId);
      }
      const scope = pointer.params.scope ?? "conversation";
      if (scope === "contact") {
        if (counts.totalContato > 1) continue;
        const jaPassou = await deps.db.jaTeveEnrollment(row.organization_id, pointer.id, contactId);
        if (jaPassou) continue;
      } else {
        if (counts.totalConversa > 1) continue;
      }
      summary.matched = true;
    } else if (pointer.kind === "keyword") {
      const keywords = pointer.params.keywords ?? [];
      matchedKw = casaPalavraChave(texto, keywords);
      if (!matchedKw) continue;
      summary.matched = true;
    } else {
      continue;
    }

    const agentId = await resolveAgentForAutomaticTrigger(deps.gateDb, row.organization_id, pointer.id);
    const noDeGatilho = await deps.db.carregaNoDeGatilho(row.organization_id, pointer.active_version_id);
    if (!noDeGatilho) continue;

    const { inserted, id, reason } = await deps.db.insereEnrollment({
      event_id: row.id,
      organization_id: row.organization_id,
      pointer_id: pointer.id,
      version_id: pointer.active_version_id,
      contact_id: contactId,
      conversation_id: conversationId,
      current_node_id: noDeGatilho,
      agent_id: agentId,
    });

    if (!inserted) {
      if (reason === "stale_origin") {
        summary.skipped_stale_origin = (summary.skipped_stale_origin ?? 0) + 1;
      } else {
        summary.skipped_existing++;
      }
      continue;
    }

    summary.enrolled++;

    if (id) {
      await deps.db.insereEventoDoEnrollment({
        organization_id: row.organization_id,
        enrollment_id: id,
        node_id: noDeGatilho,
        event_type: pointer.kind === "first_message" ? "enrolled_by_first_message" : "enrolled_by_keyword",
        payload: {
          trigger_kind: pointer.kind,
          message_id: messageId,
          conversation_id: conversationId,
          ...(pointer.kind === "keyword" && matchedKw ? { matched_keyword: matchedKw } : {}),
          ...(pointer.kind === "first_message" ? { scope: pointer.params.scope ?? "conversation" } : {}),
          event_log_id: row.id,
        },
        idempotency_key: `gatilho-inbound:${row.id}:${pointer.id}`,
      });
    }
  }

  return summary;
}

export function createSupabaseGatilhoInboundDb(admin: SupabaseClient): GatilhoInboundDb {
  return {
    async carregaPointersDeInbound(orgId) {
      const { data, error } = await admin
        .from("followup_flow_pointers")
        .select("id, organization_id, active_version_id, trigger_config")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .not("active_version_id", "is", null);
      if (error) throw new Error(error.message);

      const pointers: PointerDeInbound[] = [];
      for (const row of (data ?? []) as Array<{
        id: string;
        organization_id: string;
        active_version_id: string | null;
        trigger_config: unknown;
      }>) {
        if (!row.active_version_id) continue;
        const parsed = triggerConfigSchema.safeParse(row.trigger_config);
        if (!parsed.success) continue;
        if (parsed.data.kind === "first_message") {
          pointers.push({
            id: row.id,
            organization_id: row.organization_id,
            active_version_id: row.active_version_id,
            kind: "first_message",
            params: {
              scope: (parsed.data.params as { scope?: "contact" | "conversation" } | undefined)?.scope ?? "conversation",
            },
          });
        } else if (parsed.data.kind === "keyword") {
          pointers.push({
            id: row.id,
            organization_id: row.organization_id,
            active_version_id: row.active_version_id,
            kind: "keyword",
            params: {
              keywords: parsed.data.params.keywords,
            },
          });
        }
      }
      return pointers;
    },

    async carregaDadosDaMensagem(orgId, messageId) {
      const { data, error } = await admin
        .from("messages")
        .select("contact_id, conversation_id, body")
        .eq("organization_id", orgId)
        .eq("id", messageId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return {
        contact_id: data?.contact_id ?? null,
        conversation_id: data?.conversation_id ?? null,
        body: data?.body ?? null,
      };
    },

    async carregaContatoBloqueado(orgId, contactId) {
      const { data, error } = await admin
        .from("contacts")
        .select("is_blocked")
        .eq("organization_id", orgId)
        .eq("id", contactId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data?.is_blocked === true;
    },

    async contaMensagensInbound(orgId, contactId, conversationId) {
      const [resContato, resConversa] = await Promise.all([
        admin
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("contact_id", contactId)
          .eq("direction", "inbound"),
        admin
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("conversation_id", conversationId)
          .eq("direction", "inbound"),
      ]);

      return {
        totalContato: resContato.count ?? 0,
        totalConversa: resConversa.count ?? 0,
      };
    },

    async jaTeveEnrollment(orgId, pointerId, contactId) {
      const { count, error } = await admin
        .from("followup_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("pointer_id", pointerId)
        .eq("contact_id", contactId);
      if (error) throw new Error(error.message);
      return (count ?? 0) > 0;
    },

    async carregaNoDeGatilho(orgId, versionId) {
      const { data, error } = await admin
        .from("followup_flow_versions")
        .select("graph")
        .eq("organization_id", orgId)
        .eq("id", versionId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const graph = flowGraphSchema.parse(data.graph);
      return graph.nodes.find((n) => n.type === "trigger")?.id ?? null;
    },

    async insereEnrollment(input) {
      let boundary: ServiceBoundary | null = null;
      if (input.event_id) {
        try {
          boundary = await serviceForEvent(admin, input.organization_id, input.event_id, input.contact_id);
        } catch {
          boundary = null;
        }
      }
      if (!boundary) {
        try {
          boundary = await beginServiceAtOrigin(admin, input.organization_id, input.contact_id);
        } catch {
          boundary = null;
        }
      }
      if (!boundary) return { inserted: false, id: null, reason: "stale_origin" };

      const { data, error } = await admin
        .from("followup_enrollments")
        .insert({
          organization_id: input.organization_id,
          pointer_id: input.pointer_id,
          version_id: input.version_id,
          contact_id: input.contact_id,
          conversation_id: boundary.conversation_id ?? input.conversation_id,
          service_boundary: boundary,
          current_node_id: input.current_node_id,
          agent_id: input.agent_id,
          status: "active",
        })
        .select("id")
        .maybeSingle();

      if (error) {
        if (error.code === "23505") return { inserted: false, id: null, reason: "already_live" };
        throw new Error(error.message);
      }
      return { inserted: true, id: (data as { id: string } | null)?.id ?? null };
    },

    async insereEventoDoEnrollment(evento) {
      const { error } = await admin.from("followup_enrollment_events").insert(evento);
      if (error && error.code !== "23505") throw new Error(error.message);
    },
  };
}
