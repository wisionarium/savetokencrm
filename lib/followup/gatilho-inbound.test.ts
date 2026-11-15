import { describe, expect, it, vi } from "vitest";

import type { EventRow } from "@/lib/event-log/dispatcher";
import {
  aplicaGatilhoInbound,
  casaPalavraChave,
  EVENTO_DE_INBOUND,
  type GatilhoInboundDb,
  type GatilhoInboundDeps,
  type PointerDeInbound,
} from "./gatilho-inbound";
import type { FollowupGateDb } from "./agent-followup-gate";

function makeRow(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: "evt-123",
    organization_id: "org-1",
    event_type: EVENTO_DE_INBOUND,
    entity_kind: "message",
    entity_id: "msg-1",
    payload: {
      message_id: "msg-1",
      contact_id: "ct-1",
      conversation_id: "conv-1",
      body_preview: "Olá, quero saber mais sobre o triciclo elétrico!",
    },
    metadata: {},
    consumed_by: [],
    attempts: 0,
    ...overrides,
  };
}

describe("casaPalavraChave", () => {
  it("casa palavra exata e variações maiúsculas/minúsculas e com acentos", () => {
    expect(casaPalavraChave("Olá!", ["ola"])).toBe("ola");
    expect(casaPalavraChave("OLA TUDO BEM", ["ola"])).toBe("ola");
    expect(casaPalavraChave("quero saber o preço", ["preco"])).toBe("preco");
    expect(casaPalavraChave("QUERO", ["quero"])).toBe("quero");
  });

  it("casa frases completas com espaços", () => {
    expect(casaPalavraChave("por favor quero falar com atendente agora", ["falar com atendente"])).toBe(
      "falar com atendente",
    );
  });

  it("não casa falsos positivos em substrings de outras palavras", () => {
    expect(casaPalavraChave("comprei uma sacola grande", ["ola"])).toBeNull();
    expect(casaPalavraChave("o dolar subiu", ["ola"])).toBeNull();
    expect(casaPalavraChave("qualquer outro texto", ["quero"])).toBeNull();
  });

  it("retorna null com entrada vazia", () => {
    expect(casaPalavraChave("", ["ola"])).toBeNull();
    expect(casaPalavraChave("texto", [])).toBeNull();
  });
});

describe("aplicaGatilhoInbound", () => {
  function makeDeps(opts: {
    pointers?: PointerDeInbound[];
    isBlocked?: boolean;
    totalContato?: number;
    totalConversa?: number;
    jaTeveEnrollment?: boolean;
    inserted?: boolean;
    noDeGatilho?: string | null;
  } = {}): { deps: GatilhoInboundDeps; db: GatilhoInboundDb } {
    const db: GatilhoInboundDb = {
      carregaPointersDeInbound: vi.fn(async () => opts.pointers ?? []),
      carregaDadosDaMensagem: vi.fn(async () => ({
        contact_id: "ct-1",
        conversation_id: "conv-1",
        body: "Olá, quero atendimento",
      })),
      carregaContatoBloqueado: vi.fn(async () => opts.isBlocked ?? false),
      contaMensagensInbound: vi.fn(async () => ({
        totalContato: opts.totalContato ?? 1,
        totalConversa: opts.totalConversa ?? 1,
      })),
      jaTeveEnrollment: vi.fn(async () => opts.jaTeveEnrollment ?? false),
      carregaNoDeGatilho: vi.fn(async () => (opts.noDeGatilho !== undefined ? opts.noDeGatilho : "node-trigger-1")),
      insereEnrollment: vi.fn(async () => ({
        inserted: opts.inserted ?? true,
        id: "enrollment-1",
      })),
      insereEventoDoEnrollment: vi.fn(async () => {}),
    };

    const gateDb: FollowupGateDb = {
      loadEnabledPublishedFollowupAgents: vi.fn(async () => []),
    };

    return {
      deps: {
        db,
        gateDb,
        clock: () => new Date("2026-11-15T10:00:00Z"),
      },
      db,
    };
  }

  it("ignora eventos que não sejam message.received", async () => {
    const { deps } = makeDeps();
    const row = makeRow({ event_type: "lead.stage_changed" });
    const summary = await aplicaGatilhoInbound(deps, row);
    expect(summary.matched).toBe(false);
    expect(summary.enrolled).toBe(0);
  });

  it("ignora contato bloqueado (STOP/opt-out)", async () => {
    const { deps } = makeDeps({ isBlocked: true });
    const row = makeRow();
    const summary = await aplicaGatilhoInbound(deps, row);
    expect(summary.skipped_blocked).toBe(1);
    expect(summary.enrolled).toBe(0);
  });

  it("dispara first_message para nova conversa quando contagem <= 1", async () => {
    const pointer: PointerDeInbound = {
      id: "pointer-bv",
      organization_id: "org-1",
      active_version_id: "ver-1",
      kind: "first_message",
      params: { scope: "conversation" },
    };
    const { deps, db } = makeDeps({
      pointers: [pointer],
      totalConversa: 1,
      totalContato: 5,
    });

    const row = makeRow();
    const summary = await aplicaGatilhoInbound(deps, row);
    expect(summary.matched).toBe(true);
    expect(summary.enrolled).toBe(1);
    expect(db.insereEnrollment).toHaveBeenCalledWith(
      expect.objectContaining({
        pointer_id: "pointer-bv",
        contact_id: "ct-1",
        conversation_id: "conv-1",
      }),
    );
    expect(db.insereEventoDoEnrollment).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "enrolled_by_first_message",
        idempotency_key: "gatilho-inbound:evt-123:pointer-bv",
      }),
    );
  });

  it("pula first_message se conversa já tiver mensagens anteriores (> 1)", async () => {
    const pointer: PointerDeInbound = {
      id: "pointer-bv",
      organization_id: "org-1",
      active_version_id: "ver-1",
      kind: "first_message",
      params: { scope: "conversation" },
    };
    const { deps } = makeDeps({
      pointers: [pointer],
      totalConversa: 3,
    });

    const row = makeRow();
    const summary = await aplicaGatilhoInbound(deps, row);
    expect(summary.matched).toBe(false);
    expect(summary.enrolled).toBe(0);
  });

  it("dispara first_message com scope='contact' somente se totalContato <= 1 e sem enrollment prévio", async () => {
    const pointer: PointerDeInbound = {
      id: "pointer-bv-contact",
      organization_id: "org-1",
      active_version_id: "ver-1",
      kind: "first_message",
      params: { scope: "contact" },
    };

    // Caso 1: contato novo (totalContato = 1, jaTeveEnrollment = false) -> ENROLLA
    const { deps: deps1 } = makeDeps({
      pointers: [pointer],
      totalContato: 1,
      jaTeveEnrollment: false,
    });
    const s1 = await aplicaGatilhoInbound(deps1, makeRow());
    expect(s1.enrolled).toBe(1);

    // Caso 2: contato antigo (totalContato = 2) -> PULA
    const { deps: deps2 } = makeDeps({
      pointers: [pointer],
      totalContato: 2,
      jaTeveEnrollment: false,
    });
    const s2 = await aplicaGatilhoInbound(deps2, makeRow());
    expect(s2.enrolled).toBe(0);

    // Caso 3: contato com enrollment já realizado -> PULA
    const { deps: deps3 } = makeDeps({
      pointers: [pointer],
      totalContato: 1,
      jaTeveEnrollment: true,
    });
    const s3 = await aplicaGatilhoInbound(deps3, makeRow());
    expect(s3.enrolled).toBe(0);
  });

  it("dispara keyword quando texto casa com a palavra-chave configurada", async () => {
    const pointer: PointerDeInbound = {
      id: "pointer-kw",
      organization_id: "org-1",
      active_version_id: "ver-1",
      kind: "keyword",
      params: { keywords: ["triciclo", "preco"] },
    };
    const { deps, db } = makeDeps({
      pointers: [pointer],
      totalConversa: 10, // Mesmo que já tenha muitas mensagens na conversa!
    });

    const row = makeRow({
      payload: {
        message_id: "msg-1",
        contact_id: "ct-1",
        conversation_id: "conv-1",
        body_preview: "Gostaria de saber mais sobre o triciclo elétrico",
      },
    });

    const summary = await aplicaGatilhoInbound(deps, row);
    expect(summary.matched).toBe(true);
    expect(summary.enrolled).toBe(1);
    expect(db.insereEventoDoEnrollment).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "enrolled_by_keyword",
        payload: expect.objectContaining({
          matched_keyword: "triciclo",
        }),
      }),
    );
  });

  it("trata 23505 (já vivo em outro fluxo) graciosamente sem erro", async () => {
    const pointer: PointerDeInbound = {
      id: "pointer-kw",
      organization_id: "org-1",
      active_version_id: "ver-1",
      kind: "keyword",
      params: { keywords: ["ajuda"] },
    };
    const { deps } = makeDeps({
      pointers: [pointer],
      inserted: false, // 23505
    });

    const row = makeRow({
      payload: {
        message_id: "msg-1",
        contact_id: "ct-1",
        conversation_id: "conv-1",
        body_preview: "Preciso de ajuda urgente",
      },
    });

    const summary = await aplicaGatilhoInbound(deps, row);
    expect(summary.matched).toBe(true);
    expect(summary.enrolled).toBe(0);
    expect(summary.skipped_existing).toBe(1);
  });
});
