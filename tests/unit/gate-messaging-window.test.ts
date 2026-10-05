import { describe, expect, it } from "vitest";

import { PACING_DEFAULTS } from "@/lib/agent-engine/pacing/defaults";
import { SPINNING_DEFAULTS } from "@/lib/agent-engine/spinning/defaults";
import {
  messagingWindowGate,
  type GateContext,
} from "@/lib/agent-engine/guardrails/before-send";

const AGORA = new Date("2026-07-28T12:00:00Z");
const horasAtras = (n: number) => new Date(AGORA.getTime() - n * 3_600_000);

/** Espelha o padrÃ£o do repo: cada teste de gate monta o seu (ver case-guardrail.test.ts). */
function baseCtx(over: Partial<GateContext> = {}): GateContext {
  return {
    now: AGORA,
    body: "oi",
    optedOut: false,
    provider: "meta_cloud",
    pacing: {
      knobs: PACING_DEFAULTS,
      state: { lastSentAt: null, sentToday: 0, numberActivatedAt: null },
      crmDailyLimit: null,
      rng: () => 0,
    },
    spinning: { knobs: SPINNING_DEFAULTS, window: [] },
    lgpd: null,
    promise: { table: null },
    semanticPromise: null,
    ...over,
  } as GateContext;
}

describe("gate messaging_window", () => {
  it("provider legado (waha) falha fechado — nunca passa nem veta silencioso", () => {
    // Nao ha mais canal de auto-restricao: todo envio passa pela janela de 24h.
    // Linha legada no banco lanca em vez de cair num default que libera tudo.
    expect(() =>
      messagingWindowGate.evaluate(
        baseCtx({ provider: "waha" as never, messagingWindow: { lastInboundAt: horasAtras(99) } }),
      ),
    ).toThrow(/unknown_channel_provider/);
  });
  it("canal de hetero-restriÃ§Ã£o com janela ABERTA passa, sem skipped", () => {
    const v = messagingWindowGate.evaluate(
      baseCtx({ provider: "meta_cloud", messagingWindow: { lastInboundAt: horasAtras(2) } }),
    );
    expect(v.pass).toBe(true);
    if (!v.pass) throw new Error("inalcanÃ§Ã¡vel");
    expect(v.skipped).toBeUndefined();
  });

  it("canal de hetero-restriÃ§Ã£o com janela FECHADA veta", () => {
    const v = messagingWindowGate.evaluate(
      baseCtx({ provider: "meta_cloud", messagingWindow: { lastInboundAt: horasAtras(30) } }),
    );
    expect(v.pass).toBe(false);
    if (v.pass) throw new Error("inalcanÃ§Ã¡vel");
    expect(v.code).toBe("messaging_window_closed");
  });

  it("sem inbound nenhum veta â€” fail-closed, nÃ£o 'na dÃºvida manda'", () => {
    const v = messagingWindowGate.evaluate(
      baseCtx({ provider: "meta_cloud", messagingWindow: { lastInboundAt: null } }),
    );
    expect(v.pass).toBe(false);
  });

  it("campo AUSENTE veta â€” o default Ã© a direÃ§Ã£o segura", () => {
    // `messagingWindow` Ã© opcional no tipo; um chamador que o esqueÃ§a precisa
    // produzir veto visÃ­vel, nunca envio livre.
    const v = messagingWindowGate.evaluate(baseCtx({ provider: "meta_cloud" }));
    expect(v.pass).toBe(false);
  });

  it("a razÃ£o do veto diz a SAÃDA, nÃ£o sÃ³ o problema", () => {
    // A cadeia devolve `reason` ao modelo como erro instrutivo. Um veto que apenas
    // nega faz o modelo tentar de novo igual â€” e o turno morre em silÃªncio, que Ã©
    // o oposto do invariante 4 do sistema vivo.
    const v = messagingWindowGate.evaluate(
      baseCtx({ provider: "meta_cloud", messagingWindow: { lastInboundAt: horasAtras(30) } }),
    );
    if (v.pass) throw new Error("inalcanÃ§Ã¡vel");
    expect(v.reason).toMatch(/send_template/);
    expect(v.reason).toMatch(/template aprovado/);
  });

  it("a borda de 24h fecha â€” nÃ£o Ã© 'quase aberta'", () => {
    const v = messagingWindowGate.evaluate(
      baseCtx({ provider: "meta_cloud", messagingWindow: { lastInboundAt: horasAtras(24) } }),
    );
    expect(v.pass).toBe(false);
  });
});

describe("gate messaging_window â€” template Ã© a saÃ­da, nÃ£o um bypass", () => {
  it("template PASSA mesmo com a janela fechada â€” Ã© o caminho legÃ­timo", () => {
    const v = messagingWindowGate.evaluate(
      baseCtx({
        provider: "meta_cloud",
        messagingWindow: { lastInboundAt: horasAtras(99), isTemplate: true },
      }),
    );
    expect(v.pass).toBe(true);
  });

  it("texto livre na MESMA situaÃ§Ã£o continua vetado", () => {
    // O par prova que o passe Ã© da flag, nÃ£o do relaxamento do gate.
    const v = messagingWindowGate.evaluate(
      baseCtx({
        provider: "meta_cloud",
        messagingWindow: { lastInboundAt: horasAtras(99), isTemplate: false },
      }),
    );
    expect(v.pass).toBe(false);
  });

  it("template NÃƒO desliga os outros gates â€” sÃ³ este muda", () => {
    // A flag vive em `messagingWindow`, nÃ£o num campo global de contexto: um
    // `ctx.isTemplate` de topo convidaria outros gates a consultÃ¡-lo, e aÃ­
    // template viraria bypass de opt-out e LGPD.
    const ctx = baseCtx({
      provider: "meta_cloud",
      messagingWindow: { lastInboundAt: null, isTemplate: true },
    });
    expect(Object.keys(ctx)).not.toContain("isTemplate");
  });
});
