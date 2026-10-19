/**
 * O hub é a vitrine de um grupo: mostra TUDO que ele tem, com descrição,
 * organizado pela jornada de quem usa. É onde as sete telas que só existiam
 * atrás das abas de IA passam a ser descobertas.
 *
 * A permissão é do registro (`navegacao-registry.test.ts`); aqui é o desenho.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import { NavHub } from "@/components/shell/NavHub";
import { InstalledGuidesCards } from "@/components/extensions/InstalledGuidesCards";
import { DICIONARIO } from "@/lib/i18n/dicionario";
import type { ExtensionGuideView } from "@/lib/extensions/view";
import { hubSections } from "@/lib/navigation/registry";

afterEach(cleanup);

describe("NavHub", () => {
  const extensionGuide: ExtensionGuideView = {
    organization_id: "00000000-0000-4000-8000-000000000001",
    installation_id: "00000000-0000-4000-8000-000000000002",
    version: "1.0.0",
    revision: 3,
    configuration: { density: "compact", show_description: false },
    manifest: {
      format_version: 1,
      profile: "declarative",
      publisher: "equipe-exemplo",
      name: "rotina-comercial",
      version: "1.0.0",
      license: "MIT",
      host_api: { min: 1, max: 2 },
      permissions: ["navigation.tasks"],
      dependencies: [],
      data: { mode: "none" },
      display: {
        title: { "pt-BR": "Rotina comercial", es: "Rutina comercial" },
        summary: { "pt-BR": "Organize os próximos passos." },
        category: "sales",
        icon: "ListChecks",
      },
      configuration: { density: "comfortable", show_description: true },
      contributions: {
        crm_cards: [
          {
            id: "primeiro-passo",
            title: { "pt-BR": "Comece por aqui", es: "Empieza aquí" },
            description: { "pt-BR": "Uma descrição que a configuração esconde." },
            icon: "Lightbulb",
            blocks: [],
            action: { label: { "pt-BR": "Abrir tarefas" }, capability: "tasks.open" },
          },
        ],
      },
    },
  };

  it("apresenta as seções do hub na ordem de primeira aparição", () => {
    render(
      <NavHub group="organizacao" isPlatformAdmin role={null} title="Configurações" subtitle="" />,
    );
    const secoes = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent?.trim());
    expect(secoes).toEqual(["Sua empresa", "Dados e acesso", "Sua conta"]);
  });

  it("desenterra Provedores no hub Configurações", () => {
    render(
      <NavHub group="organizacao" isPlatformAdmin role={null} title="Configurações" subtitle="" />,
    );
    const link = screen.getByRole("link", { name: /Provedores/ });
    expect(link).toHaveAttribute("href", "/app/ai/providers");
  });

  it("cada card explica para que serve — é o que o sidebar não cabe dizer", () => {
    render(
      <NavHub group="organizacao" isPlatformAdmin role={null} title="Configurações" subtitle="" />,
    );
    const link = screen.getByRole("link", { name: /Provedores/ });
    expect(link.textContent).toMatch(/o que acontece se ela falhar/i);
  });

  it("Extensões fica em Sua empresa, visível ao viewer; Dados e acesso continua sumindo sem destino", () => {
    render(
      <NavHub group="organizacao" isPlatformAdmin={false} role="viewer" title="Org" subtitle="" />,
    );
    const secoes = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent?.trim());
    expect(secoes).toContain("Sua conta");
    expect(secoes).toContain("Sua empresa");
    expect(secoes).not.toContain("Dados e acesso");
    expect(screen.getByRole("link", { name: /Extensões/ })).toHaveAttribute(
      "href",
      "/app/extensions",
    );
    expect(screen.queryByRole("link", { name: /API Tokens/ })).toBeNull();
  });

  it("agrupa os cards sob a própria seção, não numa lista solta", () => {
    render(
      <NavHub group="organizacao" isPlatformAdmin role={null} title="Configurações" subtitle="" />,
    );
    const dados = screen.getByRole("region", { name: "Dados e acesso" });
    expect(within(dados).getByRole("link", { name: /Audit Log/ })).toBeTruthy();
    expect(within(dados).queryByRole("link", { name: /Provedores/ })).toBeNull();
  });

  it("todo texto registrado no hub de Configurações tem tradução em espanhol", () => {
    const textos = hubSections("organizacao", true, "admin").flatMap(({ section, items }) => [
      section,
      ...items.flatMap((item) => [item.label, item.description]),
    ]);

    expect(textos.filter((texto) => !DICIONARIO[texto]?.es)).toEqual([]);
  });

  it("integra contribuições tipadas sem aceitar destino vindo do pacote", () => {
    render(<InstalledGuidesCards guides={[extensionGuide]} locale="es" />);

    const contribution = screen.getByRole("link", { name: /Empieza aquí/ });
    expect(contribution).toHaveAttribute(
      "href",
      "/app/extensions/00000000-0000-4000-8000-000000000002?card=primeiro-passo",
    );
    expect(contribution).not.toHaveTextContent("Uma descrição que a configuração esconde.");
    expect(screen.getByText("Abre Tareas; no lee tus datos.")).toBeInTheDocument();
  });

  it("expõe falha de leitura das contribuições sem derrubar a página", () => {
    render(<InstalledGuidesCards guides={[]} unavailable />);

    expect(
      screen.getByRole("heading", { name: "Não foi possível conferir as orientações instaladas" }),
    ).toBeInTheDocument();
  });

  it("sem guias e sem falha não renderiza nada", () => {
    const { container } = render(<InstalledGuidesCards guides={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
