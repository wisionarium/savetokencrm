"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useT } from "@/hooks/i18n/useT";
import { Button } from "@/components/ui/button";
import { skipWhatsapp, markWhatsappConfigured } from "@/app/actions/onboarding/skipWhatsapp";
import { CanalOficialClient } from "@/components/connections/CanalOficialClient";

interface Props {
  wahaConfigured?: boolean;
  sessionName: string;
  oficialPodeReceber: boolean;
}

function isRedirectError(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof (err as { digest?: unknown }).digest === "string" &&
      (err as { digest: string }).digest.startsWith("NEXT_REDIRECT"),
  );
}

export function ConnectWhatsappClient({ sessionName, oficialPodeReceber }: Props) {
  const t = useT();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6 rounded-lg border bg-background p-6">
      {!oficialPodeReceber && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <p className="font-medium">
            {t("Webhook da API Oficial da Meta")}
          </p>
          <p className="mt-1">
            {t(
              "Você pode preencher suas credenciais da Meta agora. O webhook será registrado automaticamente para receber as mensagens dos clientes.",
            )}
          </p>
        </div>
      )}

      {/* Formulário da API Oficial da Meta */}
      <CanalOficialClient />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                await skipWhatsapp();
              } catch (err) {
                if (isRedirectError(err)) throw err;
                toast.error(`${t("Falha ao pular:")} ${String(err)}`);
              }
            })
          }
        >
          {t("Configurar mais tarde")}
        </Button>

        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                await markWhatsappConfigured(sessionName, "configured");
              } catch (err) {
                if (isRedirectError(err)) throw err;
                toast.error(`${t("Falha ao avançar:")} ${String(err)}`);
              }
            })
          }
        >
          {t("Avançar")} →
        </Button>
      </div>
    </div>
  );
}
