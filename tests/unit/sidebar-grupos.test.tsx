/**
 * Sidebar agrupado por objetivo. O que estes testes protegem:
 *
 *  - a hierarquia existe (o usuário reclamou de 17 itens no mesmo peso visual);
 *  - desde 2026-10-06, só o Inbox ocupa linha no menu (decisão do dono): o
 *    resto segue no registro e se alcança pelo ⌘K/hub/URL — ver
 *    `navegacao-registry.test.ts` para as portas;
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
  it("renderiza só o título de Atendimento — o resto saiu do menu em 2026-10-06", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    const titulos = screen
      .getAllByRole("heading")
      .map((el) => el.textContent?.trim())
      .filter(Boolean);
    // Organização não tem título aqui: seu hub (Configurações) vive no rodapé
    // fixo, fora da área que rola — medido, ele caía fora da dobra até em 1080px.
    // CRM, Agente de IA, Canais e Análise saíram do menu por decisão do dono
    // (só o Inbox no sidebar; o resto via ⌘K/hub/URL).
    expect(titulos).toEqual(["Atendimento"]);
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

  it("clicar no bloco mostra só o Inbox — os outros grupos saíram do menu", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    expandirGrupo("Atendimento");
    expect(screen.getByRole("link", { name: /Inbox/ })).toHaveAttribute("href", "/app/inbox");
    // Desde 2026-10-06 não há bloco de IA/CRM/Canais/Análise no menu: o grupo
    // sem item é omitido por `sidebarGroups`, e a porta é o ⌘K/hub/URL.
    for (const grupo of ["Agente de IA", "CRM", "Canais", "Análise"])
      expect(screen.queryByRole("button", { name: grupo })).toBeNull();
    expect(screen.queryByRole("link", { name: "Agentes" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Conhecimento" })).toBeNull();
  });

  it("Etapas do funil não mora mais no sidebar — a porta é o ⌘K/hub/URL", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    // Nem o bloco do CRM existe no menu; que o destino segue no grupo CRM é o
    // unitário `navegacao-registry` que prende (grupo, não desenho).
    expect(screen.queryByRole("button", { name: "CRM" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Etapas do funil" })).toBeNull();
  });

  it("Funis também saiu do menu — o nome próprio segue no registro", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    expect(screen.queryByRole("button", { name: "CRM" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Funis" })).toBeNull();
  });

  it("Audit Log e Nuvemshop fora do menu — a rota segue de pé", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    // Desde 2026-10-06 só o Inbox ocupa linha no menu (decisão do dono).
    // Some do MENU, não do produto: a rota e a página seguem de pé e o ⌘K
    // continua achando (`searchable()` filtra por papel, nunca por `sidebar`).
    expect(screen.queryByRole("link", { name: /Audit Log/ })).toBeNull();
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

  it("sem botões Ver tudo: o bloco de Atendimento é o caminho do Inbox", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    // Nenhum grupo oferece atalho cumulativo — o bloco É o caminho.
    expect(screen.queryByRole("link", { name: /Ver tudo/ })).toBeNull();
    expandirGrupo("Atendimento");
    expect(screen.getByRole("link", { name: /Inbox/ })).toHaveAttribute("href", "/app/inbox");
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
    // Funis saiu do menu em 2026-10-06 — não há segundo item para disputar.
    expect(screen.queryByRole("link", { name: "Funis" })).toBeNull();
  });
});
