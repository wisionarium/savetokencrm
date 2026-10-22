import type { ComponentProps, ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ConversationHeader } from "@/components/inbox/ConversationHeader";

/**
 * FOTO + NOME SÃO A PORTA DO PERFIL (decisão do dono).
 *
 * No celular, tocar no nome ou na foto abre a ficha do contato — o gesto do
 * WhatsApp. A tela do celular vive em `InboxLayout` (Sheet), então o cabeçalho
 * só precisa AVISAR; este arquivo vigia o aviso e o desenho da identidade:
 *
 *   1. o botão existe e chama `onAbrirPerfil`;
 *   2. a foto vem da rota que assina o bucket privado (`/api/v1/contacts/…`),
 *      nunca do `storage_path` cru;
 *   3. sem foto, as iniciais aparecem — e são as MESMAS da lista, porque a
 *      regra mora em `lib/contacts/iniciais-do-contato.ts`;
 *   4. sem `onAbrirPerfil` o cabeçalho continua desenhando o `<h2>` de antes:
 *      nenhum outro uso do componente quebra por causa da porta nova.
 */

vi.mock("@/hooks/inbox/useClaimConversation", () => ({
  useClaimConversation: () => ({ mutate: vi.fn(), isPending: false }),
}));
/**
 * O Radix `Avatar` só põe o `<img>` no DOM depois do evento `load` — que o
 * jsdom nunca dispara. Aqui o alvo é o NOSSO encanamento (qual `src` pedimos),
 * não o carregamento do Radix: os três primitivos viram elementos simples para
 * que o `src` seja observável.
 */
vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  // eslint-disable-next-line @next/next/no-img-element -- dublê de teste: o alvo é o `src`, não LCP.
  AvatarImage: ({ src, alt }: { src?: string; alt?: string }) => <img src={src} alt={alt} />,
  AvatarFallback: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
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
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: vi.fn(async () => ({ data: { drafts: [] } })),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock("@/components/feedback/ApiErrorToast", () => ({ showApiError: vi.fn() }));

function conversa(contato: Record<string, unknown> = {}) {
  return {
    id: "cv-1",
    organization_id: "org-1",
    contact_id: "ct-1",
    status: "open",
    assigned_to_user_id: null,
    assignee_kind: "ai",
    snooze_until: null,
    tags: [],
    contacts: {
      id: "ct-1",
      display_name: "Fulana de Tal",
      name: null,
      phone_number: "5511999999999",
      is_anonymized: false,
      ...contato,
    },
  } as unknown as ComponentProps<typeof ConversationHeader>["conversation"];
}

function renderHeader(
  conversation = conversa(),
  onAbrirPerfil?: () => void,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ConversationHeader conversation={conversation} onAbrirPerfil={onAbrirPerfil} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("a identidade do cabeçalho abre o perfil", () => {
  it("clicar no nome/foto chama o dono da ficha", () => {
    const abrir = vi.fn();
    renderHeader(conversa(), abrir);

    fireEvent.click(screen.getByTestId("abrir-perfil-do-contato"));

    expect(abrir).toHaveBeenCalledTimes(1);
  });

  it("a foto vem da rota que assina o bucket, não do caminho cru", () => {
    renderHeader(
      conversa({ avatar_storage_path: "org-1/ct-1/foto.jpg" }),
      vi.fn(),
    );

    const img = screen.getByTestId("abrir-perfil-do-contato").querySelector("img");
    expect(img?.getAttribute("src")).toBe("/api/v1/contacts/ct-1/avatar");
    // O caminho do bucket não é servível e não pode vazar para o DOM.
    expect(document.body.innerHTML).not.toContain("org-1/ct-1/foto.jpg");
  });

  it("sem foto, desenha as iniciais da MESMA regra da lista", () => {
    renderHeader(conversa(), vi.fn());

    expect(screen.getByTestId("abrir-perfil-do-contato").textContent).toContain("FT");
    expect(screen.getByTestId("abrir-perfil-do-contato").querySelector("img")).toBeNull();
  });

  it("contato anonimizado não monta a rota da foto", () => {
    renderHeader(
      conversa({ avatar_storage_path: "org-1/ct-1/foto.jpg", is_anonymized: true }),
      vi.fn(),
    );

    expect(screen.getByTestId("abrir-perfil-do-contato").querySelector("img")).toBeNull();
  });

  it("sem `onAbrirPerfil` o cabeçalho mantém o `<h2>` de antes", () => {
    // Guarda de vacuidade: o botão novo não pode ter substituído o desenho
    // antigo em usos que não pediram a porta (ex.: a passagem de conversa).
    renderHeader(conversa());

    expect(screen.queryByTestId("abrir-perfil-do-contato")).toBeNull();
    expect(screen.getByRole("heading", { name: "Fulana de Tal" })).toBeTruthy();
  });
});
