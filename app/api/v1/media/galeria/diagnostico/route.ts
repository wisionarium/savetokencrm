/**
 * GET /api/v1/media/galeria/diagnostico — manager+.
 *
 * Raio-X passo a passo do que a Galeria precisa: sessão/role, tabelas
 * (migration 0344 aplicada?), bucket e escrita. Cada passo diz ok/falha com
 * o erro cru — em vez de adivinhar pelo 500 do console, abra esta URL
 * logado e leia o primeiro passo com ok:false.
 */
import { randomUUID } from "node:crypto";
import { ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Passo = { passo: string; ok: boolean; detalhe: string };

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "galeria" });
  if (!authz.ok) return authz.response;
  const { user, org: activeOrg } = authz;
  const passos: Passo[] = [
    { passo: "sessao_e_role", ok: true, detalhe: `${user.id.slice(0, 8)}… / ${activeOrg.role} / ${activeOrg.orgId}` },
  ];
  const admin = createAdminClient();

  const checar = async (passo: string, fn: () => Promise<string>) => {
    try {
      passos.push({ passo, ok: true, detalhe: await fn() });
    } catch (err) {
      passos.push({
        passo,
        ok: false,
        detalhe: err instanceof Error ? err.message : String(err),
      });
    }
  };

  await checar("tabela_galeria_pastas", async () => {
    const { error } = await admin
      .from("galeria_pastas")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", activeOrg.orgId);
    if (error) throw new Error(`${error.code ?? "?"}: ${error.message}`);
    return "existe e lê";
  });

  await checar("tabela_galeria_arquivos", async () => {
    const { error } = await admin
      .from("galeria_arquivos")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", activeOrg.orgId);
    if (error) throw new Error(`${error.code ?? "?"}: ${error.message}`);
    return "existe e lê";
  });

  await checar("bucket_whatsapp_media", async () => {
    const { data, error } = await admin.storage.from("whatsapp-media").list(activeOrg.orgId, {
      limit: 1,
    });
    if (error) throw new Error(error.message);
    return `lista ok (${data?.length ?? 0} prefixos visíveis)`;
  });

  return ok({ passos }, { requestId });
}
