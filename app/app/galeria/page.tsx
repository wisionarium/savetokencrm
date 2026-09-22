import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { GaleriaClient } from "./_components/GaleriaClient";

export const dynamic = "force-dynamic";

export default async function GaleriaPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");

  return (
    <div className="flex h-full flex-col">
      <GaleriaClient />
    </div>
  );
}
