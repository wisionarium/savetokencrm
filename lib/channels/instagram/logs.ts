/**
 * Gerenciador e gravador de logs de integração do Instagram/Meta.
 * Armazena eventos e diagnósticos em organizations.settings.instagram_logs.
 */
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export interface InstagramLogEntry {
  id: string;
  timestamp: string;
  level: "info" | "success" | "warn" | "error";
  category: "webhook" | "oauth" | "automation" | "diagnostic";
  title: string;
  details?: string;
  metadata?: Record<string, unknown>;
}

const MAX_LOGS = 60;

export async function appendInstagramLog(
  orgId: string | null,
  entry: Omit<InstagramLogEntry, "id" | "timestamp">,
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const newEntry: InstagramLogEntry = {
      id: `log_${randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };

    let targetOrgIds: string[] = [];

    if (orgId) {
      targetOrgIds = [orgId];
    } else {
      // Se não passou orgId (ex: webhook GET de verificação da Meta antes de ter org vinculada)
      const { data: orgs } = await supabase.from("organizations").select("id, settings").limit(5);
      if (orgs && orgs.length > 0) {
        const connectedOrg = orgs.find((o) => {
          const s = (o.settings as Record<string, unknown>) || {};
          return !!s.instagram_connection;
        });
        targetOrgIds = [connectedOrg ? connectedOrg.id : orgs[0]!.id];
      }
    }

    for (const id of targetOrgIds) {
      const { data: orgData } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", id)
        .single();

      const currentSettings = (orgData?.settings as Record<string, unknown>) || {};
      const currentLogs = (currentSettings.instagram_logs as InstagramLogEntry[]) || [];
      const updatedLogs = [newEntry, ...currentLogs].slice(0, MAX_LOGS);

      await supabase
        .from("organizations")
        .update({
          settings: {
            ...currentSettings,
            instagram_logs: updatedLogs,
          },
        })
        .eq("id", id);
    }
  } catch (err) {
    logger.error("append_instagram_log_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
