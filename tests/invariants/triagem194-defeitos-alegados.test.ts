import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import pg from "pg";

import type { HandlerCtx } from "@/lib/api/handlers/types";

import { pgComoSupabase } from "../pg-como-supabase";

/**
 * ARQUIVO DE TRIAGEM (PR #194) â€” NÃƒO Ã‰ PARA MERGE.
 *
 * O que ele protege: a alegaÃ§Ã£o do corpo do PR de que existiam TRÃŠS defeitos
 * vivos de escrita em coluna gerada, cada um com um efeito de usuÃ¡rio
 * diferente. Nenhum dos trÃªs tinha, na `main` 9249e6f2, teste que medisse
 * COMPORTAMENTO â€” o gate que o PR traz
 * (`colunas-geradas-nao-sao-escritas.test.ts`) varre TEXTO do fonte, e texto
 * nÃ£o Ã© comportamento.
 *
 * Por que merece catraca: `GENERATED ALWAYS ... STORED` faz o Postgres recusar
 * a INSTRUÃ‡ÃƒO INTEIRA (SQLSTATE 428C9). O campo que se perde nÃ£o Ã© o gerado â€”
 * Ã© o UPDATE todo. Os trÃªs caminhos aqui chamam o CÃ“DIGO DE PRODUÃ‡ÃƒO
 * (`patchContactHandler`, a rota POST de anonimizaÃ§Ã£o, `dispatchWahaEvent`),
 * nunca SQL escrito Ã  mÃ£o: SQL Ã  mÃ£o prova que o banco se defende, e o que
 * estÃ¡ em disputa Ã© o que o cÃ³digo manda.
 *
 * As duas bordas de autenticaÃ§Ã£o da rota de LGPD sÃ£o as ÃšNICAS coisas
 * substituÃ­das (`createClient` e `requireRole`). O corpo da rota â€” a cascata,
 * a ordem, o objeto do UPDATE â€” Ã© o de produÃ§Ã£o.
 */
const container = process.env.TEST_DB_CONTAINER;
if (!container) {
  throw new Error("TEST_DB_CONTAINER not set");
}

const PORT = Number(process.env.TEST_DB_PORT ?? 54329);
const pool = new pg.Pool({
  connectionString: `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`,
  max: 3,
});
const db = pgComoSupabase(pool);

const ORG = "d194b000-0000-4000-8000-000000000001";
const USUARIO = "d194b000-0000-4000-8000-0000000000a1";
const VIEWER = "d194b000-0000-4000-8000-0000000000a2";
const requestDbPool = new pg.Pool({
  connectionString: `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`,
  max: 1,
});
let requestUser = USUARIO;

/**
 * A rota de LGPD Ã© um Route Handler: ela busca o client dela sozinha. Trocamos
 * SÃ“ o transporte (o mesmo `pgComoSupabase` dos demais) e o `getUser`, que Ã©
 * borda de autenticaÃ§Ã£o e nÃ£o tem nada a ver com o defeito medido.
 */
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    const actor = requestUser;
    // Uma Ãºnica conexÃ£o conserva o mesmo papel/claim durante todas as queries
    // emitidas pelo Route Handler, como o PostgREST faria para a request.
    await requestDbPool.query("set role authenticated");
    await requestDbPool.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: actor, role: "authenticated", aal: "aal2" }),
    ]);
    const base = pgComoSupabase(requestDbPool) as unknown as Record<string, unknown>;
    return {
      ...base,
      from: base.from,
      rpc: base.rpc,
      auth: {
        getUser: async () => ({ data: { user: { id: actor } }, error: null }),
      },
    };
  },
}));

vi.mock("@/lib/auth/require-role", () => ({
  requireRole: async () => ({ ok: true }),
}));

function ctx(): HandlerCtx {
  return {
    organization_id: ORG,
    actor: { type: "user", id: USUARIO },
    requestId: "req-triagem-194",
  };
}

async function criarContato(campos: Record<string, unknown> = {}): Promise<string> {
  const base: Record<string, unknown> = {
    organization_id: ORG,
    display_name: "Alvo da triagem",
    source: "manual",
    ...campos,
  };
  const chaves = Object.keys(base);
  const { rows } = await pool.query<{ id: string }>(
    `insert into contacts (${chaves.map((k) => `"${k}"`).join(",")})
     values (${chaves.map((_, i) => `$${i + 1}`).join(",")}) returning id`,
    chaves.map((k) =>
      typeof base[k] === "object" && base[k] !== null ? JSON.stringify(base[k]) : base[k],
    ),
  );
  return rows[0]!.id;
}

beforeAll(async () => {
  await pool.query(
    `insert into organizations (id, slug, legal_name, display_name)
     values ($1, 'org-triagem-194', 'Triagem LTDA', 'Triagem') on conflict (id) do nothing`,
    [ORG],
  );
  await pool.query(
    `insert into auth.users (id, email) values
       ($1, 'admin-triagem-194@invariant.test'),
       ($2, 'viewer-triagem-194@invariant.test')
     on conflict (id) do nothing`,
    [USUARIO, VIEWER],
  );
  await pool.query(
    `insert into user_organizations (organization_id, user_id, role, accepted_at)
     values ($1, $2, 'admin', now()), ($1, $3, 'viewer', now())`,
    [ORG, USUARIO, VIEWER],
  );
});

afterAll(async () => {
  await requestDbPool.end();
  await pool.query("delete from organizations where id = $1", [ORG]);
  await pool.query("delete from auth.users where id = any($1::uuid[])", [[USUARIO, VIEWER]]);
  await pool.end();
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• CONTROLE POSITIVO DO INSTRUMENTO â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

describe("o instrumento", () => {
  it("as colunas geradas que este arquivo supÃµe EXISTEM no banco medido", async () => {
    // Sem isto, um banco sem as colunas geradas faria todos os casos abaixo
    // passarem verdes por ausÃªncia de causa â€” e o relatÃ³rio diria "nÃ£o
    // reproduz" onde o certo seria "nÃ£o medi".
    const { rows } = await pool.query<{ chave: string }>(
      `select table_name || '.' || column_name as chave
         from information_schema.columns
        where table_schema='public' and is_generated='ALWAYS'`,
    );
    const chaves = rows.map((r) => r.chave);
    expect(chaves).toContain("contacts.email_normalized");
    expect(chaves).toContain("channel_sessions.is_warmup_complete");
  });
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• DEFEITO 2 â€” e-mail do contato â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

describe("defeito 2 â€” salvar e-mail de contato", () => {
  it("o PATCH conclui e o e-mail fica gravado", async () => {
    const { patchContactHandler } = await import("@/app/api/v1/contacts/_handler");
    const id = await criarContato();

    let erro: unknown = null;
    await patchContactHandler(db, ctx(), id, { email: "cliente@exemplo.com" } as never).catch(
      (e) => {
        erro = e;
      },
    );

    const { rows } = await pool.query<{ email: string | null; email_normalized: string | null }>(
      "select email, email_normalized from contacts where id = $1",
      [id],
    );
    expect(
      erro === null,
      `o handler lanÃ§ou: ${(erro as { detail?: string; message?: string })?.detail ?? (erro as Error)?.message}`,
    ).toBe(true);
    expect(rows[0]!.email, "o e-mail nÃ£o foi gravado").toBe("cliente@exemplo.com");
    // A derivada tem de sair do banco sozinha.
    expect(rows[0]!.email_normalized).toBe("cliente@exemplo.com");
  });

  it("o PATCH nÃ£o leva junto os OUTROS campos da mesma instruÃ§Ã£o", async () => {
    // O que custa caro em coluna gerada nÃ£o Ã© o campo gerado: Ã© a instruÃ§Ã£o
    // inteira abortando e derrubando campos que nada tÃªm a ver com ela.
    const { patchContactHandler } = await import("@/app/api/v1/contacts/_handler");
    const id = await criarContato();

    await patchContactHandler(db, ctx(), id, {
      email: "outro@exemplo.com",
      name: "Nome que precisa sobreviver",
    } as never).catch(() => null);

    const { rows } = await pool.query<{ name: string | null }>(
      "select name from contacts where id = $1",
      [id],
    );
    expect(rows[0]!.name, "o campo vizinho morreu junto com o e-mail").toBe(
      "Nome que precisa sobreviver",
    );
  });
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• DEFEITO 3 â€” anonimizaÃ§Ã£o LGPD â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

describe("defeito 3 â€” anonimizaÃ§Ã£o LGPD", () => {
  it("o contato SAI anonimizado do banco", async () => {
    const { POST } = await import("@/app/api/v1/lgpd/anonymize/route");
    const id = await criarContato({ name: "Titular Real", email: "titular@exemplo.com" });

    const req = {
      json: async () => ({ contact_id: id, justification: "pedido do titular via triagem" }),
      headers: new Headers(),
    } as unknown as Request;

    const res = await POST(req as never);
    const corpo = (await res.json()) as Record<string, unknown>;

    const { rows } = await pool.query<{
      is_anonymized: boolean;
      name: string | null;
      email: string | null;
    }>("select is_anonymized, name, email from contacts where id = $1", [id]);

    expect(
      rows[0]!.is_anonymized,
      `a anonimizaÃ§Ã£o NÃƒO aconteceu â€” resposta ${res.status} ${JSON.stringify(corpo)}`,
    ).toBe(true);
    expect(rows[0]!.name, "o nome do titular continua no banco").toBeNull();
    expect(rows[0]!.email, "o e-mail do titular continua no banco").toBeNull();
  });

  it("membro sem papel admin recebe 403 e o contato permanece intacto", async () => {
    const { POST } = await import("@/app/api/v1/lgpd/anonymize/route");
    const id = await criarContato({ name: "Titular Protegido", email: "protegido@exemplo.com" });
    requestUser = VIEWER;
    try {
      const req = {
        json: async () => ({ contact_id: id, justification: "tentativa sem permissÃ£o" }),
        headers: new Headers(),
      } as unknown as Request;
      const res = await POST(req as never);
      expect(res.status).toBe(403);
      const { rows } = await pool.query<{ is_anonymized: boolean; email: string | null }>(
        "select is_anonymized, email from contacts where id = $1",
        [id],
      );
      expect(rows[0]).toEqual({ is_anonymized: false, email: "protegido@exemplo.com" });
    } finally {
      requestUser = USUARIO;
    }
  });
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• DEFEITO 4 â€” fim do warm-up congela o canal â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: async () => null }));
