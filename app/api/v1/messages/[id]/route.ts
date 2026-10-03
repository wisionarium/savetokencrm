import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * DELETE /api/v1/messages/[id] — apaga uma mensagem que FALHOU.
 *
 * Política (LGPD + auditoria): só sai linha com `status = 'failed'` — ela
 * nunca chegou ao canal, então não há histórico a preservar nem "apagar para
 * todos" a fazer. Mensagem enviada/entregue/lida NÃO apaga por aqui (422): o
 * log de auditoria é append-only e a prova do que saiu precisa continuar
 * existindo. Autor da mensagem OU manager+ pode apagar; resto recebe 403.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { audit } from "@/lib/audit";
import { fail, noContent } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { roleAtLeast } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: NextRequest, { params }: RouteParams): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "messages" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { user, org } = authz;
  const { id } = await params;

  const supabase = await createClient();
  const { data: message } = await supabase
    .from("messages")
    .select("id, conversation_id, direction, status, sent_by_user_id, media_storage_path")
    .eq("id", id)
    .eq("organization_id", org.orgId)
    .maybeSingle();
  if (!message) return fail("not_found", t("Mensagem não encontrada."), 404, { requestId });

  if (message.direction !== "outbound" || message.status !== "failed") {
    return fail(
      "unprocessable",
      t("Só mensagem com falha de envio pode ser apagada. O histórico do que saiu é preservado."),
      422,
      { requestId },
    );
  }

  if (message.sent_by_user_id !== user.id && !roleAtLeast(org.role, "manager")) {
    return fail("forbidden", t("Só o autor ou manager+ pode apagar esta mensagem."), 403, {
      requestId,
    });
  }

  const { data: deleted, error } = await supabase
    .from("messages")
    .delete()
    .eq("id", id)
    .eq("organization_id", org.orgId)
    .select("id, media_storage_path")
    .maybeSingle();
  if (error) {
    logger.error("[messages.delete] falha ao apagar mensagem", {
      requestId,
      organizationId: org.orgId,
      messageId: id,
      erro: error.message,
    });
    return fail("internal_error", t("Erro ao excluir mensagem."), 500, { requestId });
  }
  if (!deleted) return fail("not_found", t("Mensagem não encontrada."), 404, { requestId });

  // Best-effort: o áudio/imagem falhado também sai do bucket para não ocupar
  // espaço nem manter dado do titular. Falha aqui não desfaz a exclusão.
  const path = (deleted as { media_storage_path?: string | null }).media_storage_path;
  if (path) {
    try {
      const admin = createAdminClient();
      const { error: storageErr } = await admin.storage.from("whatsapp-media").remove([path]);
      if (storageErr) {
        logger.warn("[messages.delete] mídia órfã no bucket", {
          requestId,
          organizationId: org.orgId,
          messageId: id,
          erro: storageErr.message,
        });
      }
    } catch (erro) {
      logger.warn("[messages.delete] mídia órfã no bucket", {
        requestId,
        organizationId: org.orgId,
        messageId: id,
        erro: erro instanceof Error ? erro.message : String(erro),
      });
    }
  }

  void audit({
    action: "message.deleted",
    actorUserId: user.id,
    organizationId: org.orgId,
    resourceType: "message",
    resourceId: deleted.id,
    requestId,
  });
  return noContent(requestId);
}
