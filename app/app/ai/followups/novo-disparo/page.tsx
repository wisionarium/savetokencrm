import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { DispatchFlowEditor } from "../[id]/_components/DispatchFlowEditor";

export const dynamic = "force-dynamic";

export default async function NovoDisparoPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (ROLE_RANK[activeOrg.role] < ROLE_RANK.manager) {
    redirect("/403");
  }

  return (
    <div className="flex h-full flex-col">
      <DispatchFlowEditor flowId={null} />
    </div>
  );
}
