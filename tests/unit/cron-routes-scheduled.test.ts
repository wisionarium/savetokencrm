import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * TODA ROTA DE CRON EXISTE PARA SER CHAMADA POR ALGUEM.
 *
 * Sem scheduler no repo (Vercel + Supabase Cloud), o agendamento vive no
 * painel da Vercel, fora do versionamento: a cerca mecanica contra o
 * crontab do `docker/scheduler/entrypoint.sh` morreu com o scheduler.
 * O que resta exigivel no repo: todo diretorio de cron tem `route.ts`
 * (rota quebrada no disco tambem nunca roda), e o segredo do agendador
 * externo continua copiado (ver abaixo).
 */

const RAIZ = join(__dirname, "..", "..");
const DIR_CRON = join(RAIZ, "app", "api", "v1", "cron");

/** As rotas que existem, lidas do disco. */
function rotasNoCodigo(): string[] {
  return readdirSync(DIR_CRON, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

describe("rotas de cron existem no disco com handler", () => {
  it("todo diretorio de cron tem route.ts", () => {
    const semHandler = rotasNoCodigo().filter((r) => {
      try {
        readFileSync(join(DIR_CRON, r, "route.ts"), "utf8");
        return false;
      } catch {
        return true;
      }
    });
    expect(semHandler).toEqual([]);
  });
});

describe("o segredo que um agendador externo manda", () => {
  it("lib/env.ts copia CRON_SECRET para INTERNAL_CRON_SECRET", () => {
    // Esta é a ÚNICA guarda dessa cópia no repositório. Para conferir em vez de
    // acreditar nesta linha:
    //
    //   git grep -l 'INTERNAL_CRON_SECRET = vercelCron'
    //
    // Se a saída for só `lib/env.ts` e este arquivo, apagar este `it` deixa a
    // cópia sem cerca nenhuma.
    //
    // A cópia não existe por causa de plano de hospedagem nenhum — existe porque
    // agendador externo que injeta `CRON_SECRET` no ambiente do app e chama a
    // rota com `Authorization: Bearer <CRON_SECRET>` é padrão de mercado, e
    // `lib/auth/cron-auth.ts` só confere o Bearer contra INTERNAL_CRON_SECRET e
    // INTERNAL_SECRET. Sem a cópia, quem agenda por esse caminho leva 403 em toda
    // rodada, e o `curl -fsS` do agendador manda o corpo para /dev/null: mesmo modo
    // de falha silencioso dos outros casos deste arquivo.
    //
    // O caminho oficial deste produto é outro: o `crond` do serviço `scheduler`
    // manda `Bearer $INTERNAL_SECRET` (docker/scheduler/entrypoint.sh), que a
    // `autorizaCron` já aceita direto, sem passar por esta cópia.
    const fonte = readFileSync(join(RAIZ, "lib", "env.ts"), "utf8");
    expect(fonte).toContain("process.env.CRON_SECRET");
    expect(fonte).toContain("env.INTERNAL_CRON_SECRET = vercelCron");
  });
});
