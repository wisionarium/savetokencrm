/**
 * Invariante da matriz capability Ã— provider (`docs/doctrine/restricao-de-canal.md`).
 *
 * Mora em `tests/unit/` â€” e nÃ£o em `tests/invariants/` como o plano dizia â€” por
 * mediÃ§Ã£o, nÃ£o por gosto: `vitest.config.ts` EXCLUI `tests/invariants/**` do
 * `test:unit`, essa pasta sÃ³ roda via `pnpm test:db` (Docker + Postgres efÃªmero) e
 * `.github/workflows/ci.yml` roda apenas typecheck + lint + `pnpm test:unit`. Um
 * teste de constante TypeScript lÃ¡ dentro exigiria um banco para rodar e **nunca
 * reprovaria o CI** â€” o oposto do que o invariante 2 da doutrina promete.
 */
import { describe, expect, it } from "vitest";
import {
  CHANNEL_CAPABILITIES,
  capabilitiesOf,
  transportaMensagem,
  type ChannelProvider,
  type ProviderDeMensagem,
} from "@/lib/channels/capabilities";

const PROVIDERS = ["meta_cloud", "zernio"] as const satisfies readonly ProviderDeMensagem[];

/**
 * Esquecer um provider aqui passa a ser erro de COMPILAÃ‡ÃƒO.
 *
 * A lista era literal e solta: um canal novo entrava em `ChannelProvider` e na
 * matriz sem nunca ser varrido por este arquivo, e o teste seguia verde
 * afirmando exaustividade que nÃ£o tinha. O tipo abaixo Ã© `never` enquanto
 * sobrar provider fora da lista, e `tsc` reprova â€” antes do teste rodar.
 */
type ProviderNaoVarrido = Exclude<ProviderDeMensagem, (typeof PROVIDERS)[number]>;
const _todoProviderEstaNaLista: ProviderNaoVarrido extends never ? true : never = true;
void _todoProviderEstaNaLista;
const CAPABILITIES = [
  "freeformOutsideWindow",
  "requiresTemplates",
  "canManageTemplates",
  "banRisk",
  "minIntervalMs",
  "voiceNote",
  "groups",
  "costPerMessage",
] as const;

describe("matriz capability Ã— provider Ã© exaustiva", () => {
  it("todo provider declara TODA capability", () => {
    for (const p of PROVIDERS) {
      for (const c of CAPABILITIES) {
        expect(CHANNEL_CAPABILITIES[p], `${p} nÃ£o declara ${c}`).toHaveProperty(c);
      }
    }
  });

  it("nenhuma capability Ã© declarada sem estar na lista (cÃ³digo morto)", () => {
    for (const p of PROVIDERS) {
      for (const key of Object.keys(CHANNEL_CAPABILITIES[p])) {
        expect(CAPABILITIES as readonly string[]).toContain(key);
      }
    }
  });

  it("resoluÃ§Ã£o Ã© fail-closed â€” provider desconhecido lanÃ§a", () => {
    expect(() => capabilitiesOf("telegram" as ChannelProvider)).toThrow(/unknown_channel_provider/);
  });

  it("chamada de voz nÃ£o responde a pergunta de canal de mensagem", () => {
    // `wacalls` Ã‰ um provider vÃ¡lido de `channel_sessions` (o CHECK do banco o
    // aceita desde a migration 0232) e NÃƒO Ã© canal de mensagem. Perguntar a ele
    // o que a matriz mede Ã© erro de categoria, e a resposta certa Ã© lanÃ§ar â€”
    // nÃ£o um objeto com tudo `false`, que faria a pergunta parecer legÃ­tima e
    // deixaria o chamador seguir adiante achando que tem um canal na mÃ£o.
    expect(() => capabilitiesOf("wacalls" as ChannelProvider)).toThrow(/unknown_channel_provider/);
    expect(transportaMensagem("wacalls")).toBe(false);
    for (const p of PROVIDERS) expect(transportaMensagem(p)).toBe(true);
    // Provider mais novo que este cÃ³digo (clone que atualizou o schema antes da
    // imagem) tambÃ©m nÃ£o serve para mandar recado.
    expect(transportaMensagem("telegram")).toBe(false);
    expect(transportaMensagem(null)).toBe(false);
  });

  it("as duas famÃ­lias de restriÃ§Ã£o sÃ£o mutuamente exclusivas por provider", () => {
    // auto-restriÃ§Ã£o (banRisk) e hetero-restriÃ§Ã£o (requiresTemplates) nunca coexistem:
    // Ã© o que a doutrina restricao-de-canal.md afirma sobre a fÃ­sica dos canais.
    //
    // NÃƒO APAGUE ESTE CASO se ele ficar vermelho. Vermelho aqui significa que algum
    // canal passou a declarar as duas famÃ­lias â€” ou seja, que a tese central da
    // doutrina ("nenhuma Ã© subconjunto da outra; elas convivem como regras irmÃ£s")
    // encontrou um contraexemplo. O conserto Ã© revisar a doutrina com o caso na mÃ£o
    // e decidir o que fazer quando as duas barram ao mesmo tempo (adiar? mudar a
    // forma da mensagem? escalar ao humano?), nÃ£o silenciar o alarme que descobriu
    // a lacuna.
    for (const p of PROVIDERS) {
      const c = CHANNEL_CAPABILITIES[p];
      expect(c.banRisk && c.requiresTemplates, `${p} declara as duas famÃ­lias`).toBe(false);
    }
  });
});
