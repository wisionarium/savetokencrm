import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * O vocabulÃ¡rio do terceiro canal â€” o que entra ANTES do transporte.
 *
 * O tipo, a matriz de capabilities, a coluna de ref e os CHECKs do banco
 * nasceram JUNTOS e antes do transporte â€” o caminho inverso obriga a uma
 * migration de correÃ§Ã£o sobre dados que jÃ¡ existem, e Ã© onde clone quebra.
 *
 * Aqui se prova o vocabulÃ¡rio e o ENCANAMENTO atÃ© o adapter. O transporte em si
 * (formato do corpo, autenticaÃ§Ã£o, respostas da API) estÃ¡ em
 * `channel-adapter-zernio.test.ts`, contra o contrato medido na API real.
 */
import {
  CHANNEL_CAPABILITIES,
  CHANNEL_PROVIDER_ZERNIO,
  capabilitiesOf,
} from "@/lib/channels/capabilities";
import { getAdapter } from "@/lib/channels";
import type { OutboundEnvelope } from "@/lib/channels";
import { CHANNEL_SESSION_REF_COLUMNS, resolveSessionRef } from "@/lib/channels/session-ref";

const ZERNIO = CHANNEL_PROVIDER_ZERNIO;

describe("capabilities do canal intermediado", () => {
  it("descreve o PERMITIDO, que Ã© o do canal oficial â€” quem intermedeia muda o transporte", () => {
    expect(capabilitiesOf(ZERNIO)).toEqual({
      freeformOutsideWindow: false,
      requiresTemplates: true,
      canManageTemplates: true,
      banRisk: false,
      minIntervalMs: 6000,
      voiceNote: "opus-only",
      groups: "limited",
      costPerMessage: true,
    });
  });

  it("nÃ£o herda o perfil do canal por QR â€” o que muda Ã© o risco, e errar aqui desarma o anti-ban", () => {
    expect(capabilitiesOf(ZERNIO).banRisk).toBe(false);
  });

  it("freeformOutsideWindow=false estÃ¡ MEDIDO: a API aceita e a Meta recusa a entrega", () => {
    // A API devolve 200 + wamid, e o webhook traz depois:
    //   131047 "The 24-hour customer service window for this contact is closed."
    // Declarar `true` aqui faria a cadeia before_send liberar um envio que a
    // plataforma descarta em silÃªncio â€” o operador vÃª "enviado" e o cliente
    // nunca recebe.
    expect(capabilitiesOf(ZERNIO).freeformOutsideWindow).toBe(false);
    expect(capabilitiesOf(ZERNIO).requiresTemplates).toBe(true);
  });

  it("voiceNote Ã© opus-only: o provider tem a flag mas NÃƒO converte", () => {
    // Ler o booleano do provider como "ele resolve para mim" Ã© o erro que manda
    // mp3 e entrega anexo de mÃºsica em vez de bolha de voz.
    expect(capabilitiesOf(ZERNIO).voiceNote).toBe("opus-only");
  });
});

describe("identificador da sessÃ£o", () => {
  it("resolve pelo id do INTERMEDIÃRIO, nÃ£o pelo da Meta", () => {
    expect(
      resolveSessionRef({ provider: ZERNIO as "zernio", zernio_account_id: "acc_123" }),
    ).toBe("acc_123");
  });

  it("a coluna entra no select â€” sem ela o ref volta indefinido em runtime", () => {
    expect(CHANNEL_SESSION_REF_COLUMNS).toContain("zernio_account_id");
  });

  it("cada canal resolve pela SUA coluna â€” nenhum cai na do outro", () => {
    expect(resolveSessionRef({ provider: "waha", waha_session_name: "s1" })).toBe("s1");
    expect(
      resolveSessionRef({ provider: "meta_cloud", meta_phone_number_id: "pn1" }),
    ).toBe("pn1");
  });
});

describe("o canal tem transporte", () => {
  it("getAdapter devolve o adapter do canal, nÃ£o o de outro", () => {
    // Cair no canal por QR por default seria pior que lanÃ§ar: enviar pelo canal
    // errado Ã© pior que nÃ£o enviar.
    expect(getAdapter(ZERNIO).provider).toBe(ZERNIO);
  });

  it("os cÃ³digos de erro nomeiam o canal â€” o operador precisa saber qual falhou", () => {
    expect(getAdapter(ZERNIO).codes.sendFailed).toContain("zernio");
  });
});

describe("o envelope carrega a thread do provider", () => {
  it("OutboundEnvelope aceita providerConversationId e Ã© OPCIONAL", () => {
    // Opcional Ã© o ponto: os dois adapters existentes derivam o destinatÃ¡rio do
    // contato e nÃ£o mudam uma linha por causa deste campo.
    const semThread: OutboundEnvelope = {
      organizationId: "00000000-0000-4000-8000-000000000236",
      sessionRef: "s",
      to: "t",
      kind: "text",
      body: "x",
    };
    const comThread: OutboundEnvelope = { ...semThread, providerConversationId: "6a35" };
    expect(semThread.providerConversationId).toBeUndefined();
    expect(comThread.providerConversationId).toBe("6a35");
  });

  it("o handler LÃŠ a coluna e a PASSA ao adapter â€” o elo que some sem barulho", () => {
    const fonte = readFileSync("app/api/v1/messages/_handler.ts", "utf8");
    // Ler sem passar, ou passar sem ler, deixa o envio livre quebrado sÃ³ neste
    // canal â€” e sÃ³ quando alguÃ©m tentar responder dentro da janela.
    // A rÃ©gua Ã© PERTENCER ao select, nÃ£o ficar ao lado de uma coluna vizinha.
    // A versÃ£o anterior casava /group_chat_id,\s*provider_conversation_id/ â€” e
    // adjacÃªncia Ã© acidente de formataÃ§Ã£o, nÃ£o a propriedade guardada: o PR #225
    // inseriu `bot_silenced_until` entre as duas e reprovou um handler que lia e
    // passava a coluna exatamente como antes. Gate que reprova o inocente ensina
    // a contornar gate.
    const convSelect = /const convSelect =[\s\S]*?`([^`]+)`/.exec(fonte)?.[1];
    expect(convSelect, "nÃ£o achei o convSelect do handler â€” o teste ficou cego").toBeTruthy();
    expect(convSelect, "falta a coluna no select da conversa").toContain(
      "provider_conversation_id",
    );
    // QUATRO desde que o cartÃ£o de contato passou a sair pelo canal: texto,
    // mÃ­dia, modelo e contato. O nÃºmero Ã© conferido, e nÃ£o `>= 1`, justamente
    // para obrigar quem acrescenta um call site novo a DECIDIR se ele tambÃ©m
    // carrega a thread â€” foi assim que este caso pegou a rama de modelo, que a
    // princÃ­pio nÃ£o precisaria dela mas precisa quando o provider reaproveita a
    // conversa existente, e foi assim que ele pegou a de contato agora.
    //
    // A resposta para o cartÃ£o de contato Ã© a mesma das outras trÃªs: o canal
    // oficial endereÃ§a por thread prÃ³pria, e um cartÃ£o enviado sem ela abriria
    // conversa nova em vez de continuar a que estÃ¡ aberta.
    const passagens = [...fonte.matchAll(/providerConversationId:\s*c\.provider_conversation_id/g)];
    expect(
      passagens.length,
      "todos os call sites (texto, mÃ­dia, modelo e contato) precisam passar",
    ).toBe(4);
  });
});

describe("banco e TypeScript falam o mesmo vocabulÃ¡rio", () => {
  // O `pnpm test:db` prova isto contra um Postgres real; aqui Ã© a leitura do
  // artefato que o self-hoster de fato aplica â€” o baseline, nÃ£o as migrations.
  const baseline = readFileSync("supabase/baseline.sql", "utf8");

  it("o CHECK de provider do baseline conhece o canal novo", () => {
    expect(baseline).toMatch(/channel_sessions_provider_check[\s\S]{0,300}'zernio'/);
  });

  it("o CHECK de ref exige a coluna do canal novo", () => {
    expect(baseline).toMatch(/provider = 'zernio'\s+and zernio_account_id\s+is not null/);
  });

  it("os CHECKs sÃ£o RECRIADOS, nÃ£o protegidos por duplicate_object", () => {
    // Num clone eles jÃ¡ existem na versÃ£o de dois providers. `exception when
    // duplicate_object` engoliria a versÃ£o nova em silÃªncio: `update.sh` verde
    // e o banco recusando a sessÃ£o do canal novo.
    expect(baseline).toContain("drop constraint if exists channel_sessions_provider_check");
    expect(baseline).toContain("drop constraint if exists channel_sessions_provider_ref_check");
  });

  it("a coluna nasce antes do CHECK que a referencia", () => {
    const col = baseline.indexOf("add column if not exists zernio_account_id");
    const check = baseline.indexOf("provider = 'zernio'");
    expect(col).toBeGreaterThan(-1);
    expect(col).toBeLessThan(check);
  });

  it("a migration versionada existe junto do apÃªndice â€” clone atualiza pelas duas vias", () => {
    const mig = readFileSync(
      "supabase/migrations/20260808020000_0131_canal_zernio_vocabulario.sql",
      "utf8",
    );
    expect(mig).toContain("zernio_account_id");
    expect(readFileSync("supabase/migrations/MANIFEST.md", "utf8")).toContain(
      "0131_canal_zernio_vocabulario",
    );
  });
});
