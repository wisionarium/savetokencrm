/**
 * GET /api/v1/media/galeria/preview?path=<storage_path> — URL assinada curta
 * para pré-visualizar um arquivo da org (viewer+).
 *
 * Por que existe: `storage_path` NÃO é URL — jogar o path cru num `<img>`
 * quebra a prévia (foi exatamente o defeito do editor de disparo). A lista
 * da Galeria já traz `preview_url`; este endpoint cobre os outros lugares
 * que guardam path (passos do fluxo, mensagens).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PREVIEW_TTL_S = 3600;

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "galeria" });
  if (!authz.ok) return authz.response;
  const { org: activeOrg } = authz;

  const path = new URL(req.url).searchParams.get("path") ?? "";
  if (!z.string().min(1).max(500).safeParse(path).success) {
    return fail("invalid_request", "Parâmetro 'path' obrigatório.", 400, { requestId });
  }
  // Trava de tenant: path fora do prefixo da org nem chega ao Storage.
  if (!path.startsWith(`${activeOrg.orgId}/`)) {
    return fail("forbidden", "Arquivo fora da organização.", 403, { requestId });
  }

  const { data, error } = await createAdminClient().storage
    .from("whatsapp-media")
    .createSignedUrl(path, PREVIEW_TTL_S);
  if (error || !data?.signedUrl) {
    return fail("not_found", "Arquivo não encontrado.", 404, { requestId });
  }
  return ok({ preview_url: data.signedUrl }, { requestId });
}
