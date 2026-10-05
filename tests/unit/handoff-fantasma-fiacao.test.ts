import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * FIAÇÃO — mesmo padrão de `gate-agenda-stall.test.ts`/`gate-vazamento-interno.test.ts`:
 * prova que os pontos de conserto do handoff "fantasma" pro gerente (achado em
 * produção — o bot dizia "vou verificar com o Fulano" repetidas
 * vezes sem nunca abrir caso nem mover o funil) estão de fato ligados na fonte,
 * não só implementados isolados.
 */
const FONTE_INBOUND = fs.readFileSync(
  path.join(process.cwd(), "lib/agent-engine/agent/inbound-turn.ts"),
  "utf8",
);

describe("fiação — casePromiseGate recebe o nome do gerente do tenant", () => {
  it("send_message passa humanPromiseExtraTargets a partir de agentConfig.handoffKeywords", () => {
    const i = FONTE_INBOUND.indexOf("send_message: tool({");
    const j = FONTE_INBOUND.indexOf("update_lead_state: tool({", i);
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
    const corpo = FONTE_INBOUND.slice(i, j);
    expect(corpo).toMatch(/humanPromiseExtraTargets:\s*agentConfig\?\.handoffKeywords/);
  });
});

describe("fiação — caso humano aberto move o lead pra etapa de handoff", () => {
  it("o fail-safe do case_promise (auto-abre-caso) chama moverParaHandoffBestEffort", () => {
    const i = FONTE_INBOUND.indexOf("chain.status === 'vetoed' && chain.code === 'case_promise_without_case'");
    expect(i).toBeGreaterThan(-1);
    const janela = FONTE_INBOUND.slice(i, i + 1800);
    expect(janela).toMatch(/openedCaseThisTurn = true;\s*\n\s*moverParaHandoffBestEffort\(/);
  });

  it("a tool open_human_case (caso deliberado do modelo) também chama moverParaHandoffBestEffort", () => {
    const i = FONTE_INBOUND.indexOf("rawTools.open_human_case = tool({");
    expect(i).toBeGreaterThan(-1);
    const janela = FONTE_INBOUND.slice(i, i + 1500);
    expect(janela).toMatch(/openedCaseThisTurn = true;\s*\n\s*moverParaHandoffBestEffort\(/);
  });

  it("moverParaHandoffBestEffort é best-effort — nunca derruba o turno (.catch, não throw)", () => {
    const i = FONTE_INBOUND.indexOf("const moverParaHandoffBestEffort = ");
    expect(i).toBeGreaterThan(-1);
    const janela = FONTE_INBOUND.slice(i, i + 500);
    expect(janela).toContain(".catch(");
  });
});

describe("fiação — lead urgente represado pelo cap de warm-up gera alerta crítico", () => {
  it("o bloco de reagendamento por cap checa detectUrgencySignal e abre agent_inbox_items kind='handoff'", () => {
    const i = FONTE_INBOUND.indexOf("pacingCapVeto !== null && outcomes.length === 0");
    expect(i).toBeGreaterThan(-1);
    const janela = FONTE_INBOUND.slice(i, i + 2000);
    // A fonte do sinal mudou de "a última inbound do histórico" para "todo inbound
    // ainda não respondido", porque o drain COALESCE rajada: um relato de risco
    // que chega na 2ª mensagem entra de carona no job da 1ª e, lido só pela
    // mensagem do job, não existiria. O que esta guarda protege é o mesmo — o
    // bloco do cap CHECA urgência antes de adiar — e agora protege mais.
    expect(janela).toContain("inboundsPendentes.some((texto) => detectUrgencySignal(texto))");
    expect(janela).toMatch(/kind:\s*'handoff'/);
    expect(janela).toMatch(/severity:\s*'critical'/);
  });
});
