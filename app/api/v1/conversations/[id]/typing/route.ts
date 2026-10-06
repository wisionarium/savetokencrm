import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { sinalizarDigitando } from "@/lib/messaging/presenca";

/**
 * POST /api/v1/conversations/[id]/typing — o atendente está digitando.
 *
 * Acende o "digitando…" no aparelho do cliente (best-effort) enquanto o texto
 * ainda está no composer. O browser chama a cada ~15s com conteúdo não enviado;
 * o indicador da Meta cai sozinho em ~25s, então a cadência o mantém aceso sem
 * rajada. Canal sem presença (hoje: o intermediado) = silêncio, sem erro.
 *
 * Sempre 200: presença é decoração, nunca motivo para erro na cara de quem
 * digita. Sem audit: nada de negócio mudou — não há o que auditar.
 */
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id: conversationId } = await ctx.params;

  const authz = await requireRole("agent", { requestId, resource: "conversations" });
  if (!authz.ok) return authz.response;

  // Client da sessão (RLS): quem não vê a conversa não acende nada nela. Sem
  // service role aqui de propósito — presença não precisa bypassar nada.
  const supabase = await createClient();

  try {
    await sinalizarDigitando(supabase, {
      organizationId: authz.org.orgId,
      conversationId,
    });
    return ok({ signaled: true }, { requestId });
  } catch {
    return ok({ signaled: false }, { requestId });
  }
}
