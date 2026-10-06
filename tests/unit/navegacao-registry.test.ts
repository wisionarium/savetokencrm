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
    expect(hrefs).toContain("/app/ai/agents");
    expect(hrefs).toContain("/app/ai/fluxos");
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

  it("o bloco de IA traz Agentes e Fluxos, sem os fluxos antigos nem o que foi para Config", () => {
    // Todas as telas do bloco aparecem clicando nele — a lista é EXATA de
    // propósito: item novo entra com decisão explícita de posição.
    // Follow-ups e Novo disparo moram na página Fluxos; Roteadores e
    // Provedores moram no hub Configurações (decisão do dono, 2026-10-06).
    const ia = sidebarGroups(true, null).find((g) => g.group.id === "ia");
    expect(ia?.items.map((i) => i.href)).toEqual([
      "/app/ai/agents",
      "/app/ai/fluxos",
      "/app/ai/inbox",
      "/app/ai/cases/avisos",
      "/app/ai/proposals",
      "/app/ai/runs",
      "/app/ai/usage",
    ]);
    expect(NAV_GROUPS.find((g) => g.id === "ia")?.hub).toBeUndefined();
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

  it("agrupa a IA nas etapas da jornada, na ordem", () => {
    const secoes = hubSections("ia", true, null).map((s) => s.section);
    expect(secoes).toEqual(["Montar o agente", "Acompanhar o agente"]);
  });

  it("o hub mostra também o que já está no sidebar — é inventário, não sobra", () => {
    const hrefs = hubSections("ia", true, null).flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).toContain("/app/ai/agents");
    expect(hrefs).toContain("/app/ai/fluxos");
    // Provedores saiu do grupo IA para o hub Configurações (decisão do dono,
    // 2026-10-06) — o inventário de cada hub cobre o próprio grupo.
    expect(hrefs).not.toContain("/app/ai/providers");
    expect(
      hubSections("organizacao", true, null).flatMap((s) => s.items.map((i) => i.href)),
    ).toContain("/app/ai/providers");
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
