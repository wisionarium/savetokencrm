import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ConversationHeader } from "@/components/inbox/ConversationHeader";

/**
 * O assistente mora no robô do header (popover), não mais embaixo do fio.
 *
 * Decisão de produto (mock do dono): o COMPONENTE é o mesmo
 * (`ReplyReviewPanel`, mesma query, mesmo fluxo) — só mudou de endereço. Este
 * arquivo vigia o endereço: o botão existe no header e o painel abre nele, com
 * o fluxo gerar→revisar intacto. O fluxo em si continua coberto pelos specs
 * `autonomia-assistida` e `qa-sugestao-rejeitada-e-motivo`.
 */

vi.mock("@/hooks/inbox/useClaimConversation", () => ({
  useClaimConversation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/inbox/useCloseConversation", () => ({
  useCloseConversation: () => ({ mutate: vi.fn(), isPending: false }),
  useReopenConversation: () => ({ mutate: vi.fn(), isPending: false }),
  useArchiveConversation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/inbox/useReleaseConversation", () => ({
  useReleaseConversation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/inbox/useResumeAiAttendance", () => ({
  useResumeAiAttendance: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/inbox/usePauseAiAttendance", () => ({
  usePauseAiAttendance: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/inbox/useSnoozeConversation", () => ({
  useSnoozeConversation: () => ({
    snooze: { mutate: vi.fn(), isPending: false },
    cancel: { mutate: vi.fn(), isPending: false },
  }),
}));
vi.mock("@/hooks/auth/AuthProvider", () => ({
  usePermission: () => true,
  useAuth: () => ({ user: { id: "u-1" }, activeOrg: { orgId: "org-1", role: "manager" } }),
}));

const getMock = vi.fn(async (..._args: unknown[]) => ({ data: { drafts: [] as never[] } }));
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock("@/components/feedback/ApiErrorToast", () => ({
  showApiError: vi.fn(),
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

beforeEach(() => {
  getMock.mockClear();
});

describe("assistente no robô do header", () => {
  it("o botão do assistente existe no header e o painel abre nele", async () => {
    renderHeader();
    const robo = screen.getByRole("button", { name: "Assistente do agente" });
    expect(robo, "o botão do robô sumiu do header").toBeTruthy();

    fireEvent.click(robo);
    const secao = await screen.findByLabelText("Assistência do agente");
    expect(secao, "o painel não abriu no popover do robô").toBeTruthy();
    expect(
      await screen.findByRole("button", { name: "Sugerir resposta" }),
      "o fluxo gerar→revisar não está no popover",
    ).toBeTruthy();
    expect(getMock).toHaveBeenCalledWith("/api/v1/conversations/cv-1/draft-reply");
  });
});
