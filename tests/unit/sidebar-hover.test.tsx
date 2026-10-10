import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";

import { Sidebar } from "@/components/shell/Sidebar";
import type { ActiveOrg, AuthUser } from "@/lib/auth/types";
import type { Branding } from "@/lib/branding";
import { MarcaDaInstalacaoProvider } from "@/lib/branding/contexto";

/**
 * HOVER TRANSITÓRIO da sidebar (novo visual): com a barra desafixada, o cursor
 * em cima expande (`w-60`) e fora recolhe (`w-16`) — sem tocar no estado
 * persistido (cookie via `toggleSidebar`).
 */

vi.mock("next/navigation", () => ({ usePathname: () => "/app/inbox" }));
vi.mock("@/app/actions/shell/toggleSidebar", () => ({ toggleSidebar: vi.fn() }));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (chave: string) => chave }));
vi.mock("@/components/connections/ConnectionHealthDot", () => ({
  ConnectionHealthDot: () => null,
}));
vi.mock("@/components/shell/VersionFooter", () => ({ VersionFooter: () => null }));

const marcaDaInstalacao: Branding = { name: "Sistema X", logoUrl: null, initial: "S" };
const usuario = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "admin@exemplo.test",
  is_platform_admin: false,
  organizations: [],
} as unknown as AuthUser;
const org = {
  orgId: "00000000-0000-4000-8000-0000000000aa",
  name: "Loja da Ana",
  role: "admin",
} as ActiveOrg;
vi.mock("@/hooks/auth/AuthProvider", () => ({
  useAuth: () => ({ user: usuario, activeOrg: org }),
}));

function renderSidebar(collapsed: boolean) {
  return render(
    <MarcaDaInstalacaoProvider marca={marcaDaInstalacao}>
      <Sidebar collapsed={collapsed} />
    </MarcaDaInstalacaoProvider>,
  );
}

function barra() {
  return screen.getByRole("complementary");
}

function comHover(suportado: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn(() => ({ matches: suportado })),
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unmountAllComponents?.();
});

describe("hover transitório da sidebar", () => {
  it("desafixada + hover: expande com o cursor e recolhe sem ele", () => {
    vi.useFakeTimers();
    comHover(true);
    renderSidebar(true);
    expect(barra().className).toContain("w-16");

    fireEvent.mouseEnter(barra());
    act(() => {
      vi.advanceTimersByTime(180);
    });
    expect(barra().className).toContain("w-60");

    fireEvent.mouseLeave(barra());
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(barra().className).toContain("w-16");
  });

  it("sem hover no dispositivo (touch): o cursor não expande nada", () => {
    vi.useFakeTimers();
    comHover(false);
    renderSidebar(true);
    fireEvent.mouseEnter(barra());
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(barra().className).toContain("w-16");
  });

  it("fixada (expandida por decisão): o hover não mexe em nada", () => {
    vi.useFakeTimers();
    comHover(true);
    renderSidebar(false);
    expect(barra().className).toContain("w-60");
    fireEvent.mouseLeave(barra());
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(barra().className).toContain("w-60");
  });
});
