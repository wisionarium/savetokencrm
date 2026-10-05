import { randomUUID } from "node:crypto";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { fail } from "@/lib/api/wrappers";

export const dynamic = "force-dynamic";

function gone() {
  return fail(
    "gone",
    "Codigo de pareamento desativado (transporte por QR removido). Conecte pela conta oficial ou pelo parceiro.",
    410,
    { requestId: randomUUID() },
  );
}

export async function GET() {
  return gone();
}

export async function POST() {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  return gone();
}
