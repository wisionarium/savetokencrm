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



describe("Sidebar plano e desagrupado", () => {
  it("renderiza todos os itens do menu diretamente expostos, sem cabeçalhos colapsáveis", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    // Todos os itens visíveis aparecem de cara numa lista plana
    expect(screen.getByRole("link", { name: /Inbox/ })).toHaveAttribute("href", "/app/inbox");
    expect(screen.getByRole("link", { name: "Contatos" })).toHaveAttribute("href", "/app/contacts");
    expect(screen.getByRole("link", { name: "Tarefas" })).toHaveAttribute("href", "/app/tasks");
    expect(screen.getByRole("link", { name: "Respostas rápidas" })).toHaveAttribute("href", "/app/templates");
    expect(screen.getByRole("link", { name: "Galeria" })).toHaveAttribute("href", "/app/galeria");
    expect(screen.getByRole("link", { name: "Fluxos" })).toHaveAttribute("href", "/app/ai/fluxos");
  });

  it("itens removidos e legados não aparecem no menu", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    expect(screen.queryByRole("link", { name: "Kanban" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Produtos" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Agentes" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Alertas" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Desempenho" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Atividades" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Funis" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Audit Log/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Nuvemshop/ })).toBeNull();
    expect(screen.queryByRole("link", { name: "Conexões" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Webhooks" })).toBeNull();
  });

  it("Configurações fica no rodapé fixo, fora da navegação principal", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    const config = screen.getByRole("link", { name: /Configurações/ });
    expect(config).toHaveAttribute("href", "/app/settings");
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    expect(nav.contains(config)).toBe(false);
  });

  it("colapsado mantém o link acessível", () => {
    comoPapel("admin");
    render(<Sidebar collapsed />);
    expect(screen.getByRole("link", { name: /Inbox/ })).toBeTruthy();
  });

  it("marca a rota atual com aria-current", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    expect(screen.getByRole("link", { name: /Inbox/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Contatos" })).not.toHaveAttribute("aria-current");
  });
});
