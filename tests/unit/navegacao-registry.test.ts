import { describe, expect, it } from "vitest";

import {
  NAV_DESTINATIONS,
  NAV_GROUPS,
  canSee,
  hubSections,
  searchable,
  sidebarGroups,
} from "@/lib/navigation/registry";

/**
 * O registro é a fonte única da navegação. Estes testes cobrem as projeções
 * puras — quem renderiza (sidebar, hub, ⌘K) não decide nada, só desenha o que
 * sai daqui. A completude do registro contra as rotas de verdade é assunto de
 * `navegacao-completude.test.ts`.
 */

const ADMIN = { platform: false, role: "admin" as const };
const MANAGER = { platform: false, role: "manager" as const };
const AGENT = { platform: false, role: "agent" as const };
const VIEWER = { platform: false, role: "viewer" as const };

function dest(href: string) {
  const d = NAV_DESTINATIONS.find((x) => x.href === href);
  if (!d) throw new Error(`destino ausente do registro: ${href}`);
  return d;
}

describe("integridade do registro", () => {
  it("não tem href duplicado", () => {
    const vistos = new Map<string, number>();
    for (const d of NAV_DESTINATIONS) vistos.set(d.href, (vistos.get(d.href) ?? 0) + 1);
    const duplicados = [...vistos.entries()].filter(([, n]) => n > 1).map(([href]) => href);
    expect(duplicados).toEqual([]);
  });

  it("todo destino aponta para um grupo declarado", () => {
    const ids = new Set(NAV_GROUPS.map((g) => g.id));
    const orfaos = NAV_DESTINATIONS.filter((d) => !ids.has(d.group)).map((d) => d.href);
    expect(orfaos).toEqual([]);
  });

  it("todo destino tem descrição — é o que o hub e o ⌘K mostram", () => {
    const semTexto = NAV_DESTINATIONS.filter((d) => d.description.trim() === "").map((d) => d.href);
    expect(semTexto).toEqual([]);
  });

  it("todo destino de um grupo com hub declara sua seção", () => {
    const comHub = new Set(NAV_GROUPS.filter((g) => g.hub).map((g) => g.id));
    const semSecao = NAV_DESTINATIONS.filter((d) => comHub.has(d.group) && !d.section).map(
      (d) => d.href,
    );
    expect(semSecao).toEqual([]);
  });
});

describe("canSee", () => {
  it("nega quem está abaixo do minRole", () => {
    expect(canSee(dest("/app/audit"), MANAGER.platform, MANAGER.role)).toBe(true);
    expect(canSee(dest("/app/audit"), AGENT.platform, AGENT.role)).toBe(false);
  });

  it("destino sem minRole é visível até para viewer", () => {
    expect(canSee(dest("/app/inbox"), VIEWER.platform, VIEWER.role)).toBe(true);
  });

  it("platform admin vê tudo, inclusive sem org ativa", () => {
    for (const d of NAV_DESTINATIONS) expect(canSee(d, true, null)).toBe(true);
  });

  it("sem papel e sem ser platform admin não vê nada", () => {
    expect(canSee(dest("/app/inbox"), false, null)).toBe(false);
  });
});

describe("sidebarGroups", () => {
  it("devolve os grupos na ordem declarada em NAV_GROUPS", () => {
    const ordem = sidebarGroups(true, null).map((g) => g.group.id);
    const esperada = NAV_GROUPS.map((g) => g.id).filter((id) => ordem.includes(id));
    expect(ordem).toEqual(esperada);
  });

  it("só inclui destino marcado como sidebar", () => {
    const hrefs = sidebarGroups(true, null).flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toContain("/app/inbox");
    expect(hrefs).toContain("/app/ai/fluxos");
    expect(hrefs).toContain("/app/templates");
    expect(hrefs).toContain("/app/galeria");
    // O bloco "Agente de IA" saiu inteiro (decisão do dono): Agentes, Alertas e
    // Aviso no WhatsApp saíram do produto, junto das telas de Análise.
    for (const fora of ["/app/ai/agents", "/app/ai/inbox", "/app/ai/cases/avisos"])
      expect(hrefs).not.toContain(fora);
    // Os fluxos saíram de Agentes para a página Fluxos (decisão do dono,
    // 2026-10-06): seguem no registro e no ⌘K, fora do menu.
    for (const fora of ["/app/ai/followups", "/app/ai/followups/novo-disparo"])
      expect(hrefs).not.toContain(fora);
    // Configuração sensível mora no hub Configurações (decisão do dono,
    // 2026-10-06) — ver o teste do hub abaixo.
    for (const fora of [
      "/app/connections",
      "/app/ai/providers",
      "/app/ai/routers",
      "/app/webhooks",
    ])
      expect(hrefs).not.toContain(fora);
    // Conhecimento, Memória, Skills e Casos saíram da navegação; Credenciais
    // mora em Configurações (grupo organizacao, fora do menu lateral).
    for (const fora of [
      "/app/ai/knowledge/sources",
      "/app/ai/memory",
      "/app/ai/skills",
      "/app/ai/cases",
      "/app/ai/credentials",
    ])
      expect(hrefs).not.toContain(fora);
    // Nuvemshop segue fora por escolha do dono do produto (ver catalogo.ts).
    expect(hrefs).not.toContain("/app/integrations/nuvemshop");
  });

  it("Etapas do funil é CRM, não Configurações — o achado que originou esta mudança", () => {
    // A porta agora é o próprio bloco do CRM no sidebar (sem hub no meio).
    //
    // O que NÃO pode voltar é o destino trocar de grupo: é isso que a primeira
    // asserção prende, e ela não depende de onde o item é desenhado.
    expect(dest("/app/settings/tenant/pipelines").group).toBe("crm");
    const sidebar = sidebarGroups(true, null)
      .find((g) => g.group.id === "crm")
      ?.items.map((i) => i.href);
    expect(sidebar).toContain("/app/settings/tenant/pipelines");
  });

  it("o CRM não tem hub: o sidebar traz as cinco telas do grupo", () => {
    const crm = sidebarGroups(true, null).find((g) => g.group.id === "crm");
    expect(crm?.items.map((i) => i.href)).toEqual([
      "/app/kanban",
      "/app/contacts",
      "/app/tasks",
      "/app/products",
      "/app/settings/tenant/pipelines",
    ]);
    expect(NAV_GROUPS.find((g) => g.id === "crm")?.hub).toBeUndefined();
  });

  it("omite o grupo inteiro quando o papel não vê nenhum item dele", () => {
    // CANAIS é todo manager+/admin: um agent não deve ver o título órfão.
    const ids = sidebarGroups(AGENT.platform, AGENT.role).map((g) => g.group.id);
    expect(ids).not.toContain("canais");
    expect(ids).toContain("atendimento");
  });

  it("Ferramentas reúne Respostas rápidas e Galeria — insumos de quem atende", () => {
    // Saíram de Atendimento para um bloco só deles (decisão do dono): são
    // insumos, não o dia a dia. A lista é EXATA de propósito — item novo entra
    // com decisão explícita de posição.
    const ferramentas = sidebarGroups(true, null).find((g) => g.group.id === "ferramentas");
    expect(ferramentas?.items.map((i) => i.href)).toEqual(["/app/templates", "/app/galeria"]);
    expect(NAV_GROUPS.find((g) => g.id === "ferramentas")?.hub).toBeUndefined();
  });

  it("Fluxos tem bandeja própria com os 3 fluxos — fora de Agentes", () => {
    const fluxos = sidebarGroups(true, null).find((g) => g.group.id === "fluxos");
    expect(fluxos?.items.map((i) => i.href)).toEqual(["/app/ai/fluxos"]);
    expect(NAV_GROUPS.find((g) => g.id === "fluxos")?.hub).toBeUndefined();
    // As rotas antigas seguem no grupo Fluxos e no ⌘K, como rotas internas.
    for (const href of ["/app/ai/followups", "/app/ai/followups/novo-disparo"] as const)
      expect(dest(href).group).toBe("fluxos");
    expect(searchable(true, null).map((d) => d.href)).toContain("/app/ai/followups");
  });

  it("os grupos Agente de IA e Análise saíram do registro", () => {
    // Os dois blocos foram removidos inteiros do produto (decisão do dono):
    // as telas de Agentes, Alertas, Aviso, Desempenho, Meta Ads, Atividades,
    // Evolução da IA, Propostas, Execuções e Uso e orçamento não existem mais.
    expect(NAV_GROUPS.map((g) => g.id)).toEqual([
      "atendimento",
      "crm",
      "ferramentas",
      "fluxos",
      "canais",
      "organizacao",
    ]);
    for (const href of [
      "/app/ai/agents",
      "/app/ai/inbox",
      "/app/ai/cases/avisos",
      "/app/metrics",
      "/app/ads/meta",
      "/app/activities",
      "/app/ai/evolution",
      "/app/ai/proposals",
      "/app/ai/runs",
      "/app/ai/usage",
    ] as const)
      expect(NAV_DESTINATIONS.some((d) => d.href === href)).toBe(false);
  });

  it("o Audit Log foi para Organização, na seção Dados e acesso", () => {
    expect(dest("/app/audit").group).toBe("organizacao");
    expect(dest("/app/audit").section).toBe("Dados e acesso");
    const hub = hubSections("organizacao", true, null).flatMap((s) => s.items.map((i) => i.href));
    expect(hub).toContain("/app/audit");
  });

  it("Conexões, Provedores, Roteadores e Webhooks moram no hub Configurações", () => {
    for (const [href, grupo] of [
      ["/app/connections", "organizacao"],
      ["/app/ai/providers", "organizacao"],
      ["/app/ai/routers", "organizacao"],
      ["/app/webhooks", "organizacao"],
    ] as const)
      expect(dest(href).group).toBe(grupo);
    const hub = hubSections("organizacao", true, null).flatMap((s) => s.items.map((i) => i.href));
    for (const href of ["/app/connections", "/app/ai/providers", "/app/ai/routers", "/app/webhooks"])
      expect(hub).toContain(href);
  });
});

describe("hubSections", () => {
  it("o hub do CRM é inventário: as cinco telas do grupo, nas duas seções", () => {
    // As seções são a régua do sidebar escrita por extenso — o que se abre todo
    // dia contra o que se define uma vez. Lista EXATA: `toContain` deixaria uma
    // tela nova entrar sem que ninguém decidisse de que lado dela ela cai.
    const secoes = hubSections("crm", true, null);
    expect(secoes.map((s) => s.section)).toEqual(["O dia a dia da venda", "Preparar a venda"]);
    expect(secoes.flatMap((s) => s.items.map((i) => i.href))).toEqual([
      "/app/kanban",
      "/app/contacts",
      "/app/tasks",
      "/app/products",
      "/app/settings/tenant/pipelines",
    ]);
  });

  it("só Organização tem hub — os outros grupos despejam tudo no sidebar", () => {
    expect(NAV_GROUPS.filter((g) => g.hub).map((g) => g.id)).toEqual(["organizacao"]);
  });

  it("o hub mostra o que não está no sidebar — é inventário, não sobra", () => {
    const hrefs = hubSections("organizacao", true, null).flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).toContain("/app/ai/providers");
    expect(hrefs).toContain("/app/audit");
    expect(hrefs).not.toContain("/app/ai/fluxos");
  });

  it("não vaza destino acima do papel", () => {
    const hrefs = hubSections("organizacao", VIEWER.platform, VIEWER.role).flatMap((s) =>
      s.items.map((i) => i.href),
    );
    expect(hrefs).not.toContain("/app/settings/api-tokens");
    expect(hrefs).toContain("/app/settings/profile");
  });

  it("some com a seção que ficou vazia pela permissão", () => {
    const secoes = hubSections("organizacao", VIEWER.platform, VIEWER.role).map((s) => s.section);
    expect(secoes).not.toContain("Dados e acesso");
  });
});

describe("searchable", () => {
  it("expõe todo destino visível, do sidebar ou não", () => {
    const hrefs = searchable(ADMIN.platform, ADMIN.role).map((d) => d.href);
    expect(hrefs).toContain("/app/ai/providers");
    expect(hrefs).toContain("/app/inbox");
  });

  it("respeita o papel", () => {
    const hrefs = searchable(AGENT.platform, AGENT.role).map((d) => d.href);
    expect(hrefs).not.toContain("/app/audit");
  });
});
