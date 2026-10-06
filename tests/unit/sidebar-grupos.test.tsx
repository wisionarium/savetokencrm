/**
 * Sidebar agrupado por objetivo. O que estes testes protegem:
 *
 *  - a hierarquia existe (o usuário reclamou de 17 itens no mesmo peso visual);
 *  - Funis é alcançável sem passar por Configurações — o achado que originou tudo;
 *  - agrupar não criou cabeçalho órfão (grupo cujos filhos a permissão filtrou);
 *  - colapsado não renderiza título nenhum: 6 rótulos em 64px seria ilegível;
 *  - os grupos nascem recolhidos (só Atendimento abre) e sem botões "Ver tudo":
 *    todo destino se alcança clicando no bloco.
 *
 * A regra de quem-vê-o-quê é do registro e está coberta em
 * `navegacao-registry.test.ts`; aqui é a superfície.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

beforeEach(() => {
  // A preferência de grupos (aberto/fechado) sobrevive em `localStorage`: sem
  // limpar, um clique de um caso vaza para o seguinte e o "padrão" deixa de
  // ser testado.
  window.localStorage.clear();
});

function expandirGrupo(nome: string) {
  fireEvent.click(screen.getByRole("button", { name: nome }));
}

describe("Sidebar agrupado", () => {
  it("renderiza os títulos de grupo na ordem de uso", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    const titulos = screen
      .getAllByRole("heading")
      .map((el) => el.textContent?.trim())
      .filter(Boolean);
    // Organização não tem título aqui: seu hub (Configurações) vive no rodapé
    // fixo, fora da área que rola — medido, ele caía fora da dobra até em 1080px.
    expect(titulos).toEqual(["Atendimento", "CRM", "Agente de IA", "Canais", "Análise"]);
  });

  it("os grupos nascem recolhidos e só Atendimento abre — o Inbox aparece de cara", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    // O dia começa no Inbox: ele está visível sem nenhum clique.
    expect(screen.getByRole("link", { name: /Inbox/ })).toBeTruthy();
    // O resto espera um clique no bloco — nada de menu de 30 itens de cara.
    expect(screen.queryByRole("link", { name: "Agentes" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Funis" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Audit Log/ })).toBeNull();
  });

  it("clicar no bloco mostra tudo do grupo, e a escolha sobrevive ao F5", () => {
    comoPapel("admin");
    const { unmount } = render(<Sidebar collapsed={false} />);
    expandirGrupo("Agente de IA");
    expect(screen.getByRole("link", { name: "Agentes" })).toHaveAttribute(
      "href",
      "/app/ai/agents",
    );
    expect(screen.getByRole("link", { name: "Uso e orçamento" })).toHaveAttribute(
      "href",
      "/app/ai/usage",
    );
    expect(screen.queryByRole("link", { name: "Conhecimento" })).toBeNull();
    unmount();
    cleanup();
    // Segunda montagem lê a preferência salva: o grupo continua aberto.
    render(<Sidebar collapsed={false} />);
    expect(screen.getByRole("link", { name: "Agentes" })).toBeTruthy();
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

  it("desenterra Audit Log — e Nuvemshop ficou de fora, por escolha", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    // O que esta linha sempre prendeu é que Audit Log não mora em
    // Configurações. A porta agora é o próprio bloco de Análise expandido.
    //
    // Canal oficial não está aqui de propósito: virou aba de Conexões no PR
    // #105, e Conexões é a porta.
    expandirGrupo("Análise");
    expect(screen.getByRole("link", { name: /Audit Log/ })).toHaveAttribute("href", "/app/audit");

    // NUVEMSHOP SAIU, e esta linha é a reversão explícita de uma decisão que
    // este mesmo teste travava: a integração tinha sido "desenterrada" para o
    // menu justamente por não ter link nenhum. O dono do produto pediu para
    // ocultá-la — não usa a integração —, então o que era garantia virou o
    // contrário, e fica dito aqui para ninguém "consertar" de volta sem saber.
    //
    // Some do MENU, não do produto: a rota e a página seguem de pé e o ⌘K
    // continua achando (`searchable()` filtra por papel, nunca por `sidebar`).
    expandirGrupo("Canais");
    expect(screen.queryByRole("link", { name: /Nuvemshop/ })).toBeNull();
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
    comoPapel("agent");
    render(<Sidebar collapsed={false} />);
    const titulos = screen.getAllByRole("heading").map((el) => el.textContent?.trim());
    expect(titulos).not.toContain("Canais");
    expect(titulos).toContain("Atendimento");
  });

  it("sem botões Ver tudo: todo destino se alcança expandindo o bloco", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    // Nenhum grupo oferece atalho cumulativo — o bloco É o caminho.
    expect(screen.queryByRole("link", { name: /Ver tudo/ })).toBeNull();
    for (const grupo of ["CRM", "Agente de IA", "Canais", "Análise"]) expandirGrupo(grupo);
    expect(screen.getByRole("link", { name: "Produtos" })).toHaveAttribute(
      "href",
      "/app/products",
    );
    expect(screen.getByRole("link", { name: "Evolução da IA" })).toHaveAttribute(
      "href",
      "/app/ai/evolution",
    );
    // Conhecimento, Memória, Skills e Casos saíram da navegação; Credenciais
    // mora em Configurações (fora do menu lateral).
    expect(screen.queryByRole("link", { name: "Conhecimento" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Credenciais" })).toBeNull();
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
    expect(screen.getByRole("link", { name: /Inbox/ })).toHaveAttribute("aria-current", "page");
    // "Kanban" saiu da interface; o item da mesma URL agora se chama "Funis".
    expandirGrupo("CRM");
    expect(screen.getByRole("link", { name: "Funis" })).not.toHaveAttribute("aria-current");
  });
});
