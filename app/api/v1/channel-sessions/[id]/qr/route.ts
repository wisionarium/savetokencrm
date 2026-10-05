import { randomUUID } from "node:crypto";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { fail } from "@/lib/api/wrappers";

export const dynamic = "force-dynamic";

function gone() {
  return fail(
    "gone",
    "Conexao por QR desativada (transporte WAHA removido). Conecte pela conta oficial (Meta) ou pelo parceiro (Zernio).",
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
