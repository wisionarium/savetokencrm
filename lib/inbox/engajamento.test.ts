import { describe, expect, it } from "vitest";

import { engajamentoDaConversa } from "@/lib/inbox/engajamento";

const AGORA = new Date("2026-10-05T12:00:00.000Z");
const iso = (ms: number) => new Date(AGORA.getTime() - ms).toISOString();

describe("engajamentoDaConversa (streak da lista)", () => {
  it("sem não-lidas, sem chama — mesmo com inbound recente", () => {
    expect(
      engajamentoDaConversa(
        { last_inbound_at: iso(60_000), last_outbound_at: null, unread_count_for_assignee: 0 },
        AGORA,
      ).nivel,
    ).toBeNull();
  });

  it("respondeu há 2 min com 1 não-lida: quente", () => {
    const r = engajamentoDaConversa(
      { last_inbound_at: iso(2 * 60_000), last_outbound_at: iso(10 * 60_000), unread_count_for_assignee: 1 },
      AGORA,
    );
    expect(r.nivel).toBe("quente");
    expect(r.motivo).toMatch(/agora há pouco/i);
  });

  it("3+ mensagens em 10 min: quente por volume, mesmo fora da janela de 5 min", () => {
    const r = engajamentoDaConversa(
      { last_inbound_at: iso(10 * 60_000), last_outbound_at: iso(60 * 60_000), unread_count_for_assignee: 4 },
      AGORA,
    );
    expect(r.nivel).toBe("quente");
    expect(r.motivo).toMatch(/4 mensagens/);
  });

  it("1 mensagem há 30 min: fria — a chama não gruda no passado", () => {
    expect(
      engajamentoDaConversa(
        { last_inbound_at: iso(30 * 60_000), last_outbound_at: null, unread_count_for_assignee: 1 },
        AGORA,
      ).nivel,
    ).toBeNull();
  });

  it("sem inbound (nunca escreveu): sem chama", () => {
    expect(
      engajamentoDaConversa(
        { last_inbound_at: null, last_outbound_at: null, unread_count_for_assignee: 2 },
        AGORA,
      ).nivel,
    ).toBeNull();
  });

  it("CONTROLE: relógio torto (inbound no futuro) não acende", () => {
    const futuro = new Date(AGORA.getTime() + 60_000).toISOString();
    expect(
      engajamentoDaConversa(
        { last_inbound_at: futuro, last_outbound_at: null, unread_count_for_assignee: 2 },
        AGORA,
      ).nivel,
    ).toBeNull();
  });
});
