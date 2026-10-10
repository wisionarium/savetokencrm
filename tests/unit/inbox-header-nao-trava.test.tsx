import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ConversationHeader } from "@/components/inbox/ConversationHeader";

/**
 * CATRACA: o header do inbox não pode voltar a travar a largura da tela.
 *
 * ## O defeito, medido
 *
 * A barra de ações deste header era `shrink-0`. Como ela não encolhia nem
 * quebrava, o `min-content` do header inteiro era **707px** — e a coluna do
 * meio do inbox é `1fr`, que é `minmax(auto, 1fr)` e não encolhe abaixo do
 * conteúdo. Resultado: o painel de CRM ficava **311px fora da viewport em
 * 1280px**. Em uma resolução de trabalho comum, o atendente não via contexto
 * nenhum do cliente.
 *
 * ## Por que este teste é o que é (e o que ele NÃO é)
 *
 * Este teste olha CLASSE, não pixel — e isso é uma limitação declarada, não um
 * descuido: `min-content`, quebra de flex e resolução de grid são cálculo de
 * layout, e o jsdom não tem engine de layout. Medir largura aqui devolveria
 * zero em tudo e passaria feliz: verde por ausência de motor.
 *
 * A medição de verdade é `tests/sonda-inbox-cabe-na-tela.ts`, que roda num
 * browser e afere as 5 larguras. Esta catraca existe porque aquela sonda não
 * roda no CI, e a regressão específica — alguém devolver `shrink-0` à barra de
 * ações "para os botões não quebrarem" — é textual e barata de pegar.
 *
 * Se um dia o CI ganhar um passo de browser, este arquivo pode morrer em favor
 * da sonda. Enquanto isso, ele é a única coisa entre a regressão e a main.
 */

vi.mock("@/hooks/inbox/useClaimConversation", () => ({
  useClaimConversation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/inbox/useCloseConversation", () => ({
  useCloseConversation: () => ({ mutate: vi.fn(), isPending: false }),
  useReopenConversation: () => ({ mutate: vi.fn(), isPending: false }),
  // O header passou a importar `useArchiveConversation` do MESMO módulo (issue
  // #923). Um dublê fechado que não acompanha a nova exportação não falha com
  // "faltou mock": falha com "useArchiveConversation is not a function", que
  // não fala nada do que este arquivo vigia.
  useArchiveConversation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/inbox/useReleaseConversation", () => ({
  useReleaseConversation: () => ({ mutate: vi.fn(), isPending: false }),
}));
// O kebab (⋮) usa `useSnoozeConversation` direto para o submenu "Lembrar" —
// sem este dublê, o hook verdadeiro rodaria sob o provider (sem fetch
// automático, mas acoplando o teste à rede por acidente).
vi.mock("@/hooks/inbox/useSnoozeConversation", () => ({
  useSnoozeConversation: () => ({
    snooze: { mutate: vi.fn(), isPending: false },
    cancel: { mutate: vi.fn(), isPending: false },
  }),
}));
// O nome do módulo importa: a primeira versão deste arquivo mockava
// "useResumeAi", que NÃO EXISTE — o real é `useResumeAiAttendance`. O teste
// passou assim mesmo (o hook verdadeiro rodou sob o provider), ou seja, o mock
// não mockava nada e ninguém era avisado. Mock de caminho inexistente é ruído
// que parece cobertura.
vi.mock("@/hooks/inbox/useResumeAiAttendance", () => ({
  useResumeAiAttendance: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/auth/AuthProvider", () => ({
  usePermission: () => true,
  useAuth: () => ({ user: { id: "u-1" }, activeOrg: { orgId: "org-1", role: "manager" } }),
}));

const conversation = {
  id: "cv-1",
  organization_id: "org-1",
  contact_id: "ct-1",
  status: "open",
  assigned_to_user_id: null,
  assignee_kind: "ai",
  snooze_until: null,
  tags: [],
  contacts: { id: "ct-1", display_name: "Fulana", name: null, phone_number: "5511999" },
} as unknown as React.ComponentProps<typeof ConversationHeader>["conversation"];

function renderHeader() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ConversationHeader conversation={conversation} />
    </QueryClientProvider>,
  );
}

describe("header do inbox — não trava a largura da tela", () => {
  it("a barra de ações NÃO é shrink-0 — era isso que impunha o piso de 707px", () => {
    const { container } = renderHeader();
    const header = container.firstElementChild as HTMLElement;
    // Guarda de vacuidade: sem header renderizado, todas as asserções abaixo
    // passariam por não haver o que verificar.
    expect(header, "o header não renderizou").toBeTruthy();

    const acoes = header.children[1] as HTMLElement;
    expect(acoes, "a barra de ações não renderizou").toBeTruthy();
    expect(
      acoes.className.split(/\s+/),
      "`shrink-0` de volta na barra de ações: o header volta a travar em 707px e o painel de CRM sai da tela em 1280px",
    ).not.toContain("shrink-0");
  });

  it("o header pode reorganizar em vez de esconder ação", () => {
    const { container } = renderHeader();
    const header = container.firstElementChild as HTMLElement;
    const acoes = header.children[1] as HTMLElement;
    // As duas pontas: o container quebra E a barra quebra internamente. Só uma
    // das duas não basta — sem a de dentro, a barra desce inteira e continua
    // pedindo a largura toda.
    expect(header.className).toContain("flex-wrap");
    expect(acoes.className).toContain("flex-wrap");
    expect(acoes.className).toContain("min-w-0");
  });

  it("o primário continua exposto e o secundário vive no kebab", () => {
    renderHeader();
    // Contrato novo (decisão de produto, mock do dono): gesto de resposta
    // (`Assumir`) nunca se esconde; `Transferir/Lembrar/Fechar` vivem no menu
    // "Mais ações". A versão anterior deste caso proibia colapsar ação em menu
    // — a direção mudou por pedido explícito do dono, não por aperto de layout,
    // e este caso agora vigia o NOVO contrato em vez do antigo.
    expect(
      screen.getByRole("button", { name: "Assumir" }),
      'o "Assumir" tem de ficar exposto — gesto de resposta não vai para menu',
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Mais ações" }),
      'o kebab "Mais ações" tem de existir no header',
    ).toBeTruthy();
  });

  it('o kebab contém Transferir, Lembrar e Fechar (conversa aberta)', async () => {
    renderHeader();
    // Radix abre o menu no `pointerdown`, não no `click`.
    const kebab = screen.getByRole("button", { name: "Mais ações" });
    fireEvent.pointerDown(kebab, { button: 0, ctrlKey: false, pointerId: 1 });
    for (const rotulo of ["Transferir", "Lembrar", "Fechar", "Arquivar"]) {
      expect(
        await screen.findByText(rotulo),
        `a ação "${rotulo}" sumiu do kebab`,
      ).toBeTruthy();
    }
  });

  it('"Ver contato" vive no kebab e aponta para a ficha', async () => {
    renderHeader();
    // Saiu da barra (onde carregava `xl:hidden` contra a duplicata do painel)
    // para o menu: no kebab a duplicata não custa linha de layout, então a
    // condição vira só "há contato".
    const kebab = screen.getByRole("button", { name: "Mais ações" });
    fireEvent.pointerDown(kebab, { button: 0, ctrlKey: false, pointerId: 1 });
    const link = (await screen.findByText("Ver contato")).closest("a") as HTMLElement;
    expect(link, "o link para o contato sumiu do kebab").toBeTruthy();
    expect(link.getAttribute("href")).toBe("/app/contacts/ct-1");
  });
});
