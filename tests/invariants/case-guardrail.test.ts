import { describe, expect, it } from "vitest";

import {
  casePromiseGate,
  type GateContext,
} from "@/lib/agent-engine/guardrails/before-send";
import { PACING_DEFAULTS } from "@/lib/agent-engine/pacing/defaults";
import { SPINNING_DEFAULTS } from "@/lib/agent-engine/spinning/defaults";

/**
 * Wave 4 (spec 15 Â§10.2) â€” o GATE do requisito mais importante do Ã©pico: a
 * invariante sagrada Ã© "o lead NUNCA recebe uma mensagem que promete envolver
 * um humano sem que exista um caso aberto correspondente". `casePromiseGate` Ã©
 * a garantia DURA (3Âª camada, before-send); estes testes exercitam a lÃ³gica do
 * gate EXAUSTIVAMENTE, puro/sÃ­ncrono (sem DB â€” `evaluate` nÃ£o faz I/O).
 *
 * A orquestraÃ§Ã£o fail-safe (1Âº veto = erro-de-ensino; 2Âº veto = auto-abre-caso
 * + re-roda a cadeia) vive em `runAgentTurn` (inbound-turn.ts), dentro do
 * `execute` de `send_message` â€” a MESMA funÃ§Ã£o monolÃ­tica que
 * `agent-config-cases.test.ts` (Wave 3a) jÃ¡ documentou como "nÃ£o tem seam de
 * teste isolÃ¡vel sem harness pesado (nÃ£o existe inbound-turn.test.ts no
 * repo)". Sem seam novo para isolar (mockar `runBeforeSend`/`openCase` exigiria
 * ou reestruturar `runAgentTurn` para injetÃ¡-los, ou reproduzir o harness
 * inteiro â€” fora do escopo desta wave); a prova ponta-a-ponta do fail-safe
 * fica para o E2E da Wave 6, como o precedente jÃ¡ estabeleceu. O que NÃƒO pode
 * faltar â€” e este arquivo prova â€” Ã© a invariante do GATE em si: ela Ã© o que
 * torna o fail-safe necessÃ¡rio E o que garante que, uma vez o caso aberto
 * (por qualquer caminho: tool do agente OU auto-abre do fail-safe), o envio
 * finalmente passa.
 */

function baseCtx(overrides: Partial<GateContext> = {}): GateContext {
  return {
    now: new Date("2026-07-23T12:00:00Z"),
    body: "",
    optedOut: false,
    provider: "meta_cloud",
    pacing: { knobs: PACING_DEFAULTS, state: { lastSentAt: null, sentToday: 0, numberActivatedAt: null }, crmDailyLimit: null },
    spinning: { knobs: SPINNING_DEFAULTS, window: [] },
    promise: { table: null },
    semanticPromise: null,
    disclosure: { template: null, isFirstOutbound: false, mode: "inject" },
    lgpd: null,
    casesEnabled: false,
    hasOpenCase: false,
    openedCaseThisTurn: false,
    ...overrides,
  };
}

describe("casePromiseGate â€” a invariante sagrada (spec 15 Â§10.2, Wave 4)", () => {
  it("veta: promessa-de-humano + !hasOpenCase + !openedCaseThisTurn + casesEnabled", () => {
    const verdict = casePromiseGate.evaluate(
      baseCtx({ casesEnabled: true, body: "vou verificar com a equipe" }),
    );
    expect(verdict.pass).toBe(false);
    if (!verdict.pass) {
      expect(verdict.code).toBe("case_promise_without_case");
      expect(verdict.reason).toMatch(/open_human_case/);
    }
  });

  it("pass: hasOpenCase=true (mesmo com promessa clara e casesEnabled)", () => {
    const verdict = casePromiseGate.evaluate(
      baseCtx({ casesEnabled: true, hasOpenCase: true, body: "vou acionar o responsÃ¡vel" }),
    );
    expect(verdict.pass).toBe(true);
  });

  it("pass: openedCaseThisTurn=true (o agente abriu o caso NESTE turno, antes deste envio)", () => {
    const verdict = casePromiseGate.evaluate(
      baseCtx({ casesEnabled: true, openedCaseThisTurn: true, body: "nosso time vai resolver isso" }),
    );
    expect(verdict.pass).toBe(true);
  });

  it("pass: casesEnabled=false â€” gate OFF (org nÃ£o habilitou casos humanos)", () => {
    const verdict = casePromiseGate.evaluate(
      baseCtx({ casesEnabled: false, body: "vou acionar o responsÃ¡vel" }),
    );
    expect(verdict.pass).toBe(true);
  });

  it("pass: fala genÃ©rica sem promessa de humano (mesmo com casesEnabled e sem caso)", () => {
    const verdict = casePromiseGate.evaluate(
      baseCtx({ casesEnabled: true, body: "vou confirmar o valor pra vocÃª" }),
    );
    expect(verdict.pass).toBe(true);
  });

  it("retrocompatibilidade: GateContext sem os 3 campos novos nÃ£o Ã© o cenÃ¡rio real (TS exige-os) â€” o " +
    "default seguro mora em runBeforeSend (casesEnabled ausente nos args ?? false); aqui provamos que, " +
    "com o valor default explÃ­cito, o gate jÃ¡ Ã© no-op", () => {
    const verdict = casePromiseGate.evaluate(
      baseCtx({ body: "vou acionar o responsÃ¡vel" }), // casesEnabled/hasOpenCase/openedCaseThisTurn = defaults (false)
    );
    expect(verdict.pass).toBe(true);
  });
});
