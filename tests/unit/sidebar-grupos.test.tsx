/**
 * Sidebar agrupado por objetivo. O que estes testes protegem:
 *
 *  - a hierarquia existe (o usuário reclamou de 17 itens no mesmo peso visual);
 *  - os fluxos moram na página Fluxos, fora de Agentes (decisão do dono,
 *    2026-10-06) — o achado antigo do Funis fora de Configurações segue valendo;
 *  - agrupar não criou cabeçalho órfão (grupo cujos filhos a permissão filtrou);
 *  - colapsado não renderiza título nenhum: 6 rótulos em 64px seria ilegível;
 *  - os grupos nascem todos recolhidos e sem botões "Ver tudo".
 *
 * A regra de quem-vê-o-quê é do registro e está coberta em
 * `navegacao-registry.test.ts`; aqui é a superfície.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Sidebar } from "@/components/shell/Sidebar";
import type { ActiveOrg, AuthUser } from "@/lib/auth/types";

const authRef: { user: Pick<AuthUser, "is_platform_admin">; activeOrg: ActiveOrg | null } = {
  user: { is_platform_admin: false },
  activeOrg: null,
};

vi.mock("@/hooks/auth/AuthProvider", () => ({
  useAuth: () => authRef,
  usePermission: () => false,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/app/inbox",
}));
vi.mock("@/components/connections/ConnectionHealthDot", () => ({
  ConnectionHealthDot: () => null,
}));
vi.mock("@/app/actions/shell/toggleSidebar", () => ({
  toggleSidebar: vi.fn(),
}));
// Busca a versão via react-query; sem QueryClientProvider ele lança, e o
// rodapé de versão não é o que estes testes examinam.
vi.mock("@/components/shell/VersionFooter", () => ({
  VersionFooter: () => null,
}));

function comoPapel(role: ActiveOrg["role"]) {
  authRef.user = { is_platform_admin: false };
  authRef.activeOrg = { orgId: "org-1", name: "Org", role };
}

afterEach(cleanup);

function expandirGrupo(nome: string) {
  fireEvent.click(screen.getByRole("button", { name: nome }));
}

describe("Sidebar agrupado", () => {
  it("renderiza os títulos de grupo na ordem de uso (Canais saiu do menu)", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    const titulos = screen
      .getAllByRole("heading")
      .map((el) => el.textContent?.trim())
      .filter(Boolean);
    // Organização não tem título aqui: seu hub (Configurações) vive no rodapé
    // fixo, fora da área que rola — medido, ele caía fora da dobra até em 1080px.
    // Canais não tem título desde 2026-10-06: Conexões e Webhooks foram para o
    // hub Configurações e a Nuvemshop segue só no ⌘K — grupo sem item no menu
    // é omitido, não órfão. Fluxos tem bandeja própria desde 2026-10-06.
    expect(titulos).toEqual(["Atendimento", "CRM", "Agente de IA", "Fluxos", "Análise"]);
  });

  it("tudo nasce recolhido ao abrir — um bloco por vez, sem exceção", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    // Nem o Inbox aparece de cara: bandeja cheia é o que se quer evitar.
    expect(screen.queryByRole("link", { name: /Inbox/ })).toBeNull();
    expect(screen.queryByRole("link", { name: "Agentes" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Funis" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Audit Log/ })).toBeNull();
  });

  it("no bloco de IA ficam SÓ Agentes, Alertas e Aviso — Fluxos tem bandeja própria", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    expandirGrupo("Agente de IA");
    expect(screen.getByRole("link", { name: "Agentes" })).toHaveAttribute(
      "href",
      "/app/ai/agents",
    );
    expect(screen.getByRole("link", { name: "Alertas" })).toHaveAttribute(
      "href",
      "/app/ai/inbox",
    );
    // Fluxos saiu para a bandeja própria; Propostas, Execuções e Uso foram
    // para a Análise; Roteadores e Provedores, para Configurações.
    expect(screen.queryByRole("link", { name: "Fluxos" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Follow-ups" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Propostas" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Roteadores" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Provedores" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Conhecimento" })).toBeNull();
  });

  it("a bandeja Fluxos leva à página dos 3 fluxos", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    expect(screen.queryByRole("link", { name: "Fluxos" })).toBeNull();
    expandirGrupo("Fluxos");
    expect(screen.getByRole("link", { name: "Fluxos" })).toHaveAttribute(
      "href",
      "/app/ai/fluxos",
    );
  });

  it("leva às Etapas do funil pelo CRM, e não por Configurações", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    // O CRM nasce recolhido: a porta existe no grupo certo, a um clique.
    expect(screen.queryByRole("link", { name: "Etapas do funil" })).toBeNull();
    expandirGrupo("CRM");
    expect(screen.getByRole("link", { name: "Etapas do funil" })).toHaveAttribute(
      "href",
      "/app/settings/tenant/pipelines",
    );
  });

  it("e os dois itens de funil não disputam o mesmo nome", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    expandirGrupo("CRM");
    expect(screen.getByRole("link", { name: "Funis" })).toHaveAttribute("href", "/app/kanban");
  });

  it("Análise traz Audit Log — e Canais saiu do menu, com Nuvemshop só no ⌘K", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    // O que esta linha sempre prendeu é que Audit Log não mora em
    // Configurações. A porta é o próprio bloco de Análise expandido.
    expandirGrupo("Análise");
    expect(screen.getByRole("link", { name: /Audit Log/ })).toHaveAttribute("href", "/app/audit");

    // CANAIS SAIU do menu em 2026-10-06 (decisão do dono): Conexões e Webhooks
    // foram para o hub Configurações, e a Nuvemshop segue só no ⌘K.
    // Some do MENU, não do produto: as rotas seguem de pé e o ⌘K continua
    // achando (`searchable()` filtra por papel, nunca por `sidebar`).
    expect(screen.queryByRole("button", { name: "Canais" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Nuvemshop/ })).toBeNull();
    expect(screen.queryByRole("link", { name: "Conexões" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Webhooks" })).toBeNull();
  });

  it("Configurações fica no rodapé, nunca dependendo de scroll", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    const config = screen.getByRole("link", { name: /Configurações/ });
    expect(config).toHaveAttribute("href", "/app/settings");
    // Fora da <nav> que rola.
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    expect(nav.contains(config)).toBe(false);
  });

  it("não deixa cabeçalho órfão quando a permissão esvazia o grupo", () => {
    // CANAIS é todo manager+/admin. Um agent não pode ver o título sozinho.
    // Fluxos também é manager+ — mesma regra.
    comoPapel("agent");
    render(<Sidebar collapsed={false} />);
    const titulos = screen.getAllByRole("heading").map((el) => el.textContent?.trim());
    expect(titulos).not.toContain("Canais");
    expect(titulos).not.toContain("Fluxos");
    expect(titulos).toContain("Atendimento");
  });

  it("sem botões Ver tudo: todo destino do menu se alcança expandindo o bloco", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    // Nenhum grupo oferece atalho cumulativo — o bloco É o caminho.
    expect(screen.queryByRole("link", { name: /Ver tudo/ })).toBeNull();
    for (const grupo of ["CRM", "Agente de IA", "Fluxos", "Análise"]) expandirGrupo(grupo);
    expect(screen.getByRole("link", { name: "Produtos" })).toHaveAttribute(
      "href",
      "/app/products",
    );
    expect(screen.getByRole("link", { name: "Evolução da IA" })).toHaveAttribute(
      "href",
      "/app/ai/evolution",
    );
    expect(screen.getByRole("link", { name: "Fluxos" })).toHaveAttribute(
      "href",
      "/app/ai/fluxos",
    );
    // Conhecimento, Memória, Skills e Casos saíram da navegação; Follow-ups
    // mora nas abas de Fluxos; Credenciais, Provedores, Roteadores, Conexões
    // e Webhooks moram em Configurações (fora do menu lateral).
    expect(screen.queryByRole("link", { name: "Conhecimento" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Credenciais" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Follow-ups" })).toBeNull();
  });

  it("colapsado esconde os títulos mas mantém os links", () => {
    comoPapel("admin");
    render(<Sidebar collapsed />);
    expect(screen.queryAllByRole("heading")).toHaveLength(0);
    expect(screen.getByRole("link", { name: /Inbox/ })).toBeTruthy();
  });

  it("marca a rota atual com aria-current", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    expandirGrupo("Atendimento");
    expect(screen.getByRole("link", { name: /Inbox/ })).toHaveAttribute("aria-current", "page");
    // "Kanban" saiu da interface; o item da mesma URL agora se chama "Funis".
    expandirGrupo("CRM");
    expect(screen.getByRole("link", { name: "Funis" })).not.toHaveAttribute("aria-current");
  });
});
