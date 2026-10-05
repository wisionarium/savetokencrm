import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ExtensionsManager } from "@/components/extensions/ExtensionsManager";
import { InstalledGuidesCards } from "@/components/extensions/InstalledGuidesCards";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { loadCrmExtensions } from "@/lib/extensions/service";
import { logger } from "@/lib/logger";
import type { ExtensionGuideView } from "@/lib/extensions/view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Extensões" };

export default async function ExtensionsPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  const idioma = user.idioma;

  let extensionGuides: ExtensionGuideView[] = [];
  let extensionsUnavailable = false;
  try {
    extensionGuides = await loadCrmExtensions(activeOrg.orgId);
  } catch (error) {
    // A gestão continua útil sem os guias, mas a falha precisa ser
    // distinguível de uma lista legitimamente vazia.
    const code = (error as { code?: unknown } | null)?.code;
    logger.warn("[extensions] página aberta sem os guias instalados", {
      organization_id: activeOrg.orgId,
      error_code: typeof code === "string" ? code : null,
    });
    extensionsUnavailable = true;
  }

  return (
    <>
      <ExtensionsManager
        key={activeOrg.orgId}
        organizationId={activeOrg.orgId}
        actorId={user.id}
        supportMode={Boolean(user.support)}
      />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 pt-0 sm:p-6 sm:pt-0">
        <InstalledGuidesCards
          guides={extensionGuides}
          unavailable={extensionsUnavailable}
          locale={idioma}
        />
      </div>
    </>
  );
}
