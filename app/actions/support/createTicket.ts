"use server";

import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";

export interface CreateTicketParams {
  mensagem: string;
  categoria?: string;
  printDataUrl?: string;
}

export async function createTicket(params: CreateTicketParams) {
  const user = await loadAuthUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const activeOrg = await resolveActiveOrg(user);
  const orgId = activeOrg?.orgId ?? "system";
  const orgName = activeOrg?.name ?? "Sem Organização";

  const ticketId = `TCK-${Date.now().toString(36).toUpperCase()}`;

  const admin = createAdminClient();

  // 1. Tenta salvar na tabela dedicada support_tickets se ela existir
  try {
    await admin.from("support_tickets").insert({
      id: ticketId,
      organization_id: orgId !== "system" ? orgId : null,
      user_id: user.id,
      user_email: user.email,
      user_name: user.full_name,
      org_name: orgName,
      message: params.mensagem,
      category: params.categoria ?? "geral",
      status: "aberto",
      attachment_url: params.printDataUrl ?? null,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Tabela pode ainda estar sendo criada no Postgres, prossegue com event_log e audit
  }

  // 2. Registra na trilha de auditoria (visível em /admin/audit)
  await audit({
    action: "support.ticket_created",
    actorUserId: user.id,
    organizationId: orgId !== "system" ? orgId : undefined,
    resourceType: "support_ticket",
    resourceId: ticketId,
    metadata: {
      ticket_id: ticketId,
      user_email: user.email,
      org_name: orgName,
      categoria: params.categoria,
      preview: params.mensagem.slice(0, 100),
      has_attachment: Boolean(params.printDataUrl),
    },
  });

  // 3. Emite evento de domínio em event_log
  if (orgId !== "system") {
    try {
      await admin.from("event_log").insert({
        organization_id: orgId,
        event_type: "support.ticket_created",
        entity_kind: "support_ticket",
        payload: {
          ticket_id: ticketId,
          user_id: user.id,
          user_email: user.email,
          message: params.mensagem,
          category: params.categoria,
        },
      });
    } catch {
      // Ignora erro se falhar event_log
    }
  }

  return { ok: true, ticketId };
}
