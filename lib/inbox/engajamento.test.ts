import { describe, expect, it } from "vitest";

import { engajamentoDaConversa } from "@/lib/inbox/engajamento";

const AGORA = new Date("2026-10-06T12:00:00.000Z");
const iso = (ms: number) => new Date(AGORA.getTime() - ms).toISOString();

describe("engajamentoDaConversa (foguinho de streak, regra v2)", () => {
  it("1 mensagem sozinha nunca acende — mesmo recente", () => {
    expect(
      engajamentoDaConversa({ last_inbound_at: iso(5 * 60_000), inbound_total: 1 }, AGORA).nivel,
    ).toBeNull();
  });

  it("0 mensagens: sem chama", () => {
    expect(
      engajamentoDaConversa({ last_inbound_at: null, inbound_total: 0 }, AGORA).nivel,
    ).toBeNull();
  });

  it("total não medido (null) vale como 0: sem chama", () => {
    expect(
      engajamentoDaConversa({ last_inbound_at: iso(5 * 60_000), inbound_total: null }, AGORA)
        .nivel,
    ).toBeNull();
  });

  it("2 mensagens, última há 10 min: quente", () => {
    const r = engajamentoDaConversa(
      { last_inbound_at: iso(10 * 60_000), inbound_total: 2 },
      AGORA,
    );
    expect(r.nivel).toBe("quente");
    expect(r.motivo).toMatch(/2 mensagens/);
  });

  it("5 mensagens, última há 50 min: quente — a janela é 1h", () => {
    const r = engajamentoDaConversa(
      { last_inbound_at: iso(50 * 60_000), inbound_total: 5 },
      AGORA,
    );
    expect(r.nivel).toBe("quente");
  });

  it("2 mensagens mas última há 61 min: fria — 1h parado apaga", () => {
    expect(
      engajamentoDaConversa({ last_inbound_at: iso(61 * 60_000), inbound_total: 2 }, AGORA)
        .nivel,
    ).toBeNull();
  });

  it("sem inbound (nunca escreveu): sem chama", () => {
    expect(
      engajamentoDaConversa({ last_inbound_at: null, inbound_total: 0 }, AGORA).nivel,
    ).toBeNull();
  });

  it("CONTROLE: relógio torto (inbound no futuro) não acende", () => {
    const futuro = new Date(AGORA.getTime() + 60_000).toISOString();
    expect(
      engajamentoDaConversa({ last_inbound_at: futuro, inbound_total: 3 }, AGORA).nivel,
    ).toBeNull();
  });
});
