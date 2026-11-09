import { describe, expect, it } from "vitest";
import { flowGraphSchema } from "@/lib/followup/graph-schema";
import { validateFlowForPublish } from "@/lib/followup/validate-publish";

export const TEMPLATES_GRAFOS_TESTE = {
  boasVindas: {
    nodes: [
      { id: "node_trigger", type: "trigger" as const, label: "Início do Fluxo", position: { x: 100, y: 150 }, config: {} },
      {
        id: "node_msg",
        type: "action" as const,
        label: "Mensagem de Boas-vindas",
        position: { x: 380, y: 150 },
        config: { mode: "text" as const, body: "Olá! Seja muito bem-vindo(a). 👋 Como posso ajudar você hoje?" },
      },
      {
        id: "node_opcoes",
        type: "match_reply" as const,
        label: "Menu de Opções",
        position: { x: 680, y: 150 },
        config: {
          branches: [
            { id: "br_atendente", label: "Falar com Atendente", op: "contains" as const, pattern: "atendente" },
          ],
          grace_timeout_ms: 900_000,
        },
      },
      {
        id: "node_fim",
        type: "end" as const,
        label: "Fim do Fluxo",
        position: { x: 980, y: 150 },
        config: { outcome: "converted" as const, note: "Atendimento iniciado" },
      },
    ],
    edges: [
      { id: "e1", source: "node_trigger", target: "node_msg", priority: 0, condition: { type: "always" as const } },
      { id: "e2", source: "node_msg", target: "node_opcoes", priority: 0, condition: { type: "always" as const } },
      { id: "e3", source: "node_opcoes", target: "node_fim", priority: 0, condition: { type: "branch" as const, branch_id: "br_atendente" } },
      { id: "e4", source: "node_opcoes", target: "node_fim", priority: 0, condition: { type: "branch" as const, branch_id: "no_reply" } },
      { id: "e5", source: "node_opcoes", target: "node_fim", priority: 0, condition: { type: "always" as const } },
    ],
  },

  sequenciaDelays: {
    nodes: [
      { id: "node_trigger", type: "trigger" as const, label: "Início do Fluxo", position: { x: 100, y: 150 }, config: {} },
      {
        id: "node_msg_1",
        type: "action" as const,
        label: "1ª Mensagem",
        position: { x: 380, y: 150 },
        config: { mode: "text" as const, body: "Olá! Tudo bem? Passando para te dar as boas-vindas." },
      },
      {
        id: "node_wait",
        type: "wait" as const,
        label: "Aguardar 1 dia",
        position: { x: 680, y: 150 },
        config: { mode: "fixed" as const, duration_ms: 86_400_000, immune_to_reply: false },
      },
      {
        id: "node_msg_2",
        type: "action" as const,
        label: "2ª Mensagem (Follow-up)",
        position: { x: 980, y: 150 },
        config: { mode: "text" as const, body: "Passando para saber se ficou com alguma dúvida sobre o que conversamos!" },
      },
      {
        id: "node_fim",
        type: "end" as const,
        label: "Fim da Sequência",
        position: { x: 1280, y: 150 },
        config: { outcome: "exhausted" as const },
      },
    ],
    edges: [
      { id: "e1", source: "node_trigger", target: "node_msg_1", priority: 0, condition: { type: "always" as const } },
      { id: "e2", source: "node_msg_1", target: "node_wait", priority: 0, condition: { type: "always" as const } },
      { id: "e3", source: "node_wait", target: "node_msg_2", priority: 0, condition: { type: "always" as const } },
      { id: "e4", source: "node_msg_2", target: "node_fim", priority: 0, condition: { type: "always" as const } },
    ],
  },

  triagemHumana: {
    nodes: [
      { id: "node_trigger", type: "trigger" as const, label: "Início do Fluxo", position: { x: 100, y: 150 }, config: {} },
      {
        id: "node_msg",
        type: "action" as const,
        label: "Pergunta de Triagem",
        position: { x: 380, y: 150 },
        config: { mode: "text" as const, body: "Olá! Você gostaria de falar sobre vendas ou suporte?" },
      },
      {
        id: "node_cond",
        type: "condition" as const,
        label: "Verificar Condição",
        position: { x: 680, y: 150 },
        config: { combinator: "and" as const, checks: [{ field: "steps_taken" as const, op: "gte" as const, value: 1 }] },
      },
      {
        id: "node_fim",
        type: "end" as const,
        label: "Fim da Triagem",
        position: { x: 980, y: 150 },
        config: { outcome: "converted" as const, note: "Encaminhado para atendimento" },
      },
    ],
    edges: [
      { id: "e1", source: "node_trigger", target: "node_msg", priority: 0, condition: { type: "always" as const } },
      { id: "e2", source: "node_msg", target: "node_cond", priority: 0, condition: { type: "always" as const } },
      { id: "e3", source: "node_cond", target: "node_fim", priority: 0, condition: { type: "cond_result" as const, value: true } },
      { id: "e4", source: "node_cond", target: "node_fim", priority: 0, condition: { type: "cond_result" as const, value: false } },
    ],
  },

  emBranco: {
    nodes: [
      { id: "node_trigger", type: "trigger" as const, label: "Início do Fluxo", position: { x: 100, y: 150 }, config: {} },
      {
        id: "node_action",
        type: "action" as const,
        label: "Enviar mensagem",
        position: { x: 380, y: 150 },
        config: { mode: "text" as const, body: "Olá! Digite sua mensagem aqui..." },
      },
      {
        id: "node_fim",
        type: "end" as const,
        label: "Fim do Fluxo",
        position: { x: 680, y: 150 },
        config: { outcome: "converted" as const },
      },
    ],
    edges: [
      { id: "e1", source: "node_trigger", target: "node_action", priority: 0, condition: { type: "always" as const } },
      { id: "e2", source: "node_action", target: "node_fim", priority: 0, condition: { type: "always" as const } },
    ],
  },
};

describe("Validação dos Grafos dos Templates de Automação", () => {
  it("o template de boas-vindas passa pelo schema e publica", () => {
    const res = flowGraphSchema.safeParse(TEMPLATES_GRAFOS_TESTE.boasVindas);
    expect(res.success, res.error?.message).toBe(true);
    if (res.success) {
      const pub = validateFlowForPublish(res.data);
      if (!pub.ok) {
        expect.fail(JSON.stringify(pub.errors));
      }
      expect(pub.ok).toBe(true);
    }
  });

  it("o template de sequência de delays passa pelo schema e publica", () => {
    const res = flowGraphSchema.safeParse(TEMPLATES_GRAFOS_TESTE.sequenciaDelays);
    expect(res.success, res.error?.message).toBe(true);
    if (res.success) {
      const pub = validateFlowForPublish(res.data);
      if (!pub.ok) {
        expect.fail(JSON.stringify(pub.errors));
      }
      expect(pub.ok).toBe(true);
    }
  });

  it("o template de triagem humana passa pelo schema e publica", () => {
    const res = flowGraphSchema.safeParse(TEMPLATES_GRAFOS_TESTE.triagemHumana);
    expect(res.success, res.error?.message).toBe(true);
    if (res.success) {
      const pub = validateFlowForPublish(res.data);
      if (!pub.ok) {
        expect.fail(JSON.stringify(pub.errors));
      }
      expect(pub.ok).toBe(true);
    }
  });

  it("o template em branco passa pelo schema e publica", () => {
    const res = flowGraphSchema.safeParse(TEMPLATES_GRAFOS_TESTE.emBranco);
    expect(res.success, res.error?.message).toBe(true);
    if (res.success) {
      const pub = validateFlowForPublish(res.data);
      if (!pub.ok) {
        expect.fail(JSON.stringify(pub.errors));
      }
      expect(pub.ok).toBe(true);
    }
  });
});
