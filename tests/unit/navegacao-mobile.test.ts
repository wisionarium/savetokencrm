import { describe, expect, it } from "vitest";

import { NAV_CATALOG, type NavMetadata } from "@/lib/navigation/catalogo";
import { ABAS_MOVEIS, abasMoveis, rotuloDaAba } from "@/lib/navigation/mobile";
import { NAV_DESTINATIONS } from "@/lib/navigation/registry";

/**
 * A BARRA DE BAIXO DO CELULAR É UMA PROJEÇÃO DO MENU, NÃO UMA SEGUNDA NAVEGAÇÃO.
 *
 * O que este arquivo guarda é o que separa um rodapé saudável de uma lista
 * paralela que envelhece mentindo: as abas têm de sair do MESMO menu que o
 * sidebar monta (`sidebarGroups` — catálogo ∩ RBAC ∩ apresentação por vínculo ∩
 * curadoria do menu) e passar pelos MESMOS filtros.
 *
 * ─── O defeito que fez o caso do `sidebar` existir ─────────────────────────
 *
 * A primeira versão da barra filtrava por `destinosDaInterface`, que olha o
 * catálogo e o vínculo — mas NÃO o campo `sidebar`. O commit 5ceeec40 tirou
 * `/app/kanban` ("Funis") do menu, e a barra o traria de volta no celular: a
 * mesma tela visível ou escondida dependendo do tamanho da janela. Nenhum teste
 * reprovava: a divergência não quebra nada, ela só mente. É o que o primeiro
 * caso abaixo prende.
 *
 * Quando isso volta a quebrar, quebra silencioso de duas formas: a barra mostra
 * uma porta que o RBAC fecha em /403, ou ressuscita no telefone um destino que
 * o dono acabou de tirar do menu. As duas viram caso aqui.
 */

const buscar = (href: string) => NAV_DESTINATIONS.find((d) => d.href === href);

describe("as abas do rodapé no celular", () => {
  it("são um recorte do catálogo — nenhuma porta inventada", () => {
    for (const href of ABAS_MOVEIS) {
      expect(
        NAV_CATALOG.some((d) => d.href === href),
        `${href} não existe em NAV_CATALOG: a barra inventou uma porta`,
      ).toBe(true);
    }
  });

  it("toda aba está no MENU — a barra espelha o sidebar, não o catálogo cru", () => {
    // Este é o caso que o defeito do commit 5ceeec40 teria reprovado: `/app/kanban`
    // continua no catálogo (a URL é viva, o ⌘K a alcança) e perdeu `sidebar: true`
    // quando o dono a tirou do menu. Aba sem `sidebar` é aba que ressuscita no
    // celular o que o desktop escondeu.
    for (const href of ABAS_MOVEIS) {
      const entrada: NavMetadata | undefined = NAV_CATALOG.find((d) => d.href === href);
      expect(entrada, `${href} não está no catálogo`).toBeDefined();
      expect(
        entrada?.sidebar,
        `${href} não está no menu do produto (sem \`sidebar: true\`): a barra de baixo ` +
          `espelha o menu, então não pode oferecer uma porta que o sidebar esconde`,
      ).toBe(true);
    }
  });

  it("destino que saiu do menu não volta pela barra — o caso do Funis", () => {
    const abas = abasMoveis(null, false, "viewer").map((d) => d.href);
    expect(NAV_CATALOG.some((d) => d.href === "/app/kanban"), "Funis saiu do catálogo?").toBe(true);
    expect(abas).not.toContain("/app/kanban");
  });

  it("a Agenda NÃO é aba própria — ela é uma aba dentro de Tarefas", () => {
    // `/app/agenda` é só redirect para `/app/tasks/agenda`, e a Agenda vive como
    // aba da tela de Tarefas. Pôr a Agenda na barra criaria um segundo endereço
    // para a mesma tela e uma rota que o registro de navegação não conhece.
    expect(ABAS_MOVEIS).not.toContain("/app/agenda");
    expect(ABAS_MOVEIS).toContain("/app/tasks");
  });

  it("sem papel resolvido, a barra não oferece porta nenhuma", () => {
    // `canSee` exige papel para quem não é admin de plataforma. Um render antes
    // da sessão resolver não pode adivinhar o vínculo da pessoa.
    expect(abasMoveis(null, false, null)).toEqual([]);
  });

  it("um viewer vê todas as abas — todas são de uso diário", () => {
    const abas = abasMoveis(null, false, "viewer").map((d) => d.href);
    expect(abas).toEqual([...ABAS_MOVEIS]);
  });

  it("admin de plataforma vê todas, sem depender de papel de organização", () => {
    const abas = abasMoveis(null, true, null).map((d) => d.href);
    expect(abas).toEqual([...ABAS_MOVEIS]);
  });

  it("preset simplificado preserva as abas que ele contém", () => {
    // `SIMPLIFICADA` (em `lib/navigation/interface.ts`) lista inbox, kanban,
    // contacts, tasks e connections. As três abas estão nela. Se a barra
    // divergisse do preset, o operador que escolheu a interface enxuta veria
    // menos no celular do que no computador.
    const abas = abasMoveis({ preset: "simplificada" }, false, "viewer").map((d) => d.href);
    expect(abas).toEqual([...ABAS_MOVEIS]);
  });

  it("destino removido pela interface desaparece da barra e mantém a ordem", () => {
    const abas = abasMoveis(
      { preset: "completa", destinos: ["/app/tasks", "/app/inbox"] },
      false,
      "viewer",
    ).map((d) => d.href);
    expect(abas).toEqual(["/app/inbox", "/app/tasks"]);
  });

  it("renomeia só o Inbox; o resto herda o rótulo do catálogo", () => {
    const inbox = buscar("/app/inbox");
    const contatos = buscar("/app/contacts");
    expect(inbox).toBeDefined();
    expect(contatos).toBeDefined();
    expect(rotuloDaAba(inbox!)).toBe("Conversas");
    expect(rotuloDaAba(contatos!)).toBe(contatos!.label);
  });
});
