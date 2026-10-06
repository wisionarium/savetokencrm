import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DragDropContext, Droppable } from "@hello-pangea/dnd";

import { KanbanCard } from "@/components/kanban/KanbanCard";
import { buildCardInput } from "@/lib/kanban/card-state";
import type { Lead } from "@/lib/types/leads";

// O menu de ações do card vive de permissão e de membros atribuíveis: sem os
// mocks, o render puxaria a API de verdade. O foguinho não depende de nenhum
// dos dois — os mocks só calam o que o teste não está medindo.
vi.mock("@/hooks/auth/AuthProvider", () => ({
  usePermission: () => false,
  useAuth: () => ({ user: { is_platform_admin: false }, activeOrg: null }),
  useActiveOrg: () => null,
}));
vi.mock("@/hooks/inbox/useAssignableMembers", () => ({
  useAssignableMembers: () => ({ data: [] }),
}));
vi.mock("@/hooks/kanban/useAssignableAgents", () => ({
  useAssignableAgents: () => ({ data: [] }),
}));

afterEach(cleanup);

// Relógio REAL de execução: a régua mede idade contra `new Date()`, então uma
// data fixa no passado distante (ou futuro) falsearia todos os casos.
const AGORA = Date.now();
const isoHa = (min: number) => new Date(AGORA - min * 60_000).toISOString();

type ConversaDoCard = Exclude<Exclude<Lead["conversa"], null>, undefined>;

function lead(conversa: ConversaDoCard | undefined, over: Partial<Lead> = {}): Lead {
  return {
    id: "l1",
    organization_id: "org",
    pipeline_id: "p1",
    stage_id: "s1",
    contact_id: "c1",
    title: "Lead de prova",
    description: null,
    value_cents: null,
    currency: "BRL",
    status: "open",
    lost_reason: null,
    position_in_stage: 1,
    owner_kind: "user",
    owner_user_id: "u1",
    owner_agent_id: null,
    assigned_at: null,
    last_activity_at: isoHa(60),
    created_at: isoHa(60 * 24 * 5),
    updated_at: isoHa(60),
    tags: [],
    custom_fields: {},
    conversa,
    ...over,
  } as Lead;
}

function renderCard(conversa: ConversaDoCard | undefined) {
  const l = lead(conversa);
  const qc = new QueryClient();
  // Draggable exige Droppable pai (e este, DragDropContext): sem os dois o
  // dnd lança "Could not find required context" antes de desenhar qualquer
  // pixel do card.
  render(
    <QueryClientProvider client={qc}>
      <DragDropContext onDragEnd={() => undefined}>
        <Droppable droppableId="teste" type="LEAD">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              <KanbanCard
                card={buildCardInput(l, {
                  stageName: "Novo",
                  ownerNames: new Map([["u1", "Ana"]]),
                })}
                lead={l}
                index={0}
                pipelineId="p1"
              />
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </QueryClientProvider>,
  );
}

describe("o foguinho no card do Kanban", () => {
  it("3 mensagens com última há 10 min: a chama aparece com o motivo", () => {
    renderCard({
      id: "conv1",
      preview: "oi",
      last_message_at: isoHa(10),
      last_inbound_at: isoHa(10),
      inbound_total: 3,
      unread: 3,
    });
    const chama = screen.getByRole("img", { name: /Lead quente/ });
    expect(chama).toHaveAttribute("title", expect.stringMatching(/3 mensagens/));
  });

  it("1 mensagem sozinha: sem chama, mesmo recente", () => {
    renderCard({
      id: "conv1",
      preview: "oi",
      last_message_at: isoHa(10),
      last_inbound_at: isoHa(10),
      inbound_total: 1,
      unread: 1,
    });
    expect(screen.queryByRole("img", { name: /Lead quente/ })).toBeNull();
  });

  it("streak vencida (última há 2h): sem chama", () => {
    renderCard({
      id: "conv1",
      preview: "oi",
      last_message_at: isoHa(120),
      last_inbound_at: isoHa(120),
      inbound_total: 5,
      unread: 0,
    });
    expect(screen.queryByRole("img", { name: /Lead quente/ })).toBeNull();
  });

  it("lead sem conversa: sem chama e sem quebrar", () => {
    renderCard(undefined);
    expect(screen.queryByRole("img", { name: /Lead quente/ })).toBeNull();
  });
});
