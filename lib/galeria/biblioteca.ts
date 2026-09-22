/**
 * Escrita/consulta da Galeria sempre com service role + filtro manual de
 * organization_id (o bucket não tem policy para anon/authenticated; as
 * tabelas têm RLS, mas rotas de upload rodam em contextos mistos).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { GaleriaOrigem } from "./contrato";

export interface GaleriaUpsert {
  organization_id: string;
  storage_path: string;
  nome: string;
  mime?: string;
  size_bytes?: number;
  largura?: number | null;
  altura?: number | null;
  origem: GaleriaOrigem;
  created_by?: string | null;
}

/** Idempotente por (organization_id, storage_path). Nunca lança. */
export async function registrarNaGaleria(
  admin: SupabaseClient,
  item: GaleriaUpsert,
): Promise<void> {
  try {
    await admin.from("galeria_arquivos").upsert(
      {
        organization_id: item.organization_id,
        storage_path: item.storage_path,
        nome: item.nome.slice(0, 120) || item.storage_path.split("/").pop() || "imagem",
        mime: item.mime ?? "image/jpeg",
        size_bytes: item.size_bytes ?? 0,
        largura: item.largura ?? null,
        altura: item.altura ?? null,
        origem: item.origem,
        created_by: item.created_by ?? null,
      },
      { onConflict: "organization_id,storage_path", ignoreDuplicates: true },
    );
  } catch {
    // Galeria é índice, não efeito: falhar aqui não pode quebrar o upload.
  }
}

const basename = (path: string) => path.split("/").pop() || path;

/**
 * Traz para a tabela o que já existe e ainda não foi registrado: arquivos
 * em `dispatch-flows/` + imagens outbound das conversas. Roda no GET da
 * lista (limitado), então instalação antiga ganha a Galeria cheia sozinha.
 */
export async function sincronizarGaleria(
  admin: SupabaseClient,
  organizationId: string,
  createdBy: string | null,
): Promise<void> {
  // 1. Uploads de fluxo (disparo e IA usam a mesma rota de upload).
  try {
    const { data: arquivos } = await admin.storage
      .from("whatsapp-media")
      .list(`${organizationId}/dispatch-flows`, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    for (const f of arquivos ?? []) {
      if (!f.name || f.name.startsWith(".")) continue;
      await registrarNaGaleria(admin, {
        organization_id: organizationId,
        storage_path: `${organizationId}/dispatch-flows/${f.name}`,
        nome: f.name,
        mime: "image/jpeg",
        size_bytes: 0,
        origem: "disparo",
        created_by: createdBy,
      });
    }
  } catch {
    // segue para a segunda fonte
  }

  // 2. Imagens que o time enviou no chat (outbound; inbound nunca entra).
  try {
    const { data: mensagens } = await admin
      .from("messages")
      .select("media_storage_path, media_mime, media_size_bytes")
      .eq("organization_id", organizationId)
      .eq("direction", "outbound")
      .eq("type", "image")
      .not("media_storage_path", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);
    const vistos = new Set<string>();
    for (const m of (mensagens ?? []) as Array<{
      media_storage_path: string | null;
      media_mime: string | null;
      media_size_bytes: number | null;
    }>) {
      const path = m.media_storage_path;
      if (!path || vistos.has(path)) continue;
      vistos.add(path);
      await registrarNaGaleria(admin, {
        organization_id: organizationId,
        storage_path: path,
        nome: basename(path),
        mime: m.media_mime ?? "image/jpeg",
        size_bytes: m.media_size_bytes ?? 0,
        origem: "chat",
        created_by: createdBy,
      });
    }
  } catch {
    // lista segue com o que já está registrado
  }
}

/** Postgres undefined_table: a migration da Galeria (0344) não foi aplicada. */
export function tabelaDaGaleriaAusente(error: { code?: string } | null): boolean {
  return !!error && (error.code === "42P01" || /galeria_(arquivos|pastas)/.test(JSON.stringify(error)));
}

/** Mensagem que diz o que fazer (o operador aplica a migration). */
export const MIGRATION_PENDENTE_MSG =
  "Tabelas da Galeria ausentes no banco (migration 0344_galeria_de_midias não aplicada). Aplique as migrations e recarregue.";

/** Onde o arquivo é usado: mensagens + grafos de fluxo. Para avisar antes de apagar. */
export async function usosDoArquivo(
  admin: SupabaseClient,
  organizationId: string,
  storagePath: string,
): Promise<{ mensagens: number; fluxos: number }> {
  let mensagens = 0;
  let fluxos = 0;
  try {
    const { count } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("media_storage_path", storagePath);
    mensagens = count ?? 0;
  } catch {
    // conta como zero
  }
  try {
    const { data: pointers } = await admin
      .from("followup_flow_pointers")
      .select("id, draft_graph")
      .eq("organization_id", organizationId);
    for (const p of (pointers ?? []) as Array<{ draft_graph: unknown }>) {
      if (JSON.stringify(p.draft_graph ?? {}).includes(storagePath)) fluxos += 1;
    }
  } catch {
    // conta como zero
  }
  return { mensagens, fluxos };
}
