/**
 * O LOGO DO OPERADOR APARECE CRU NO TEMA ESCURO — SEM MOLDURA CLARA.
 *
 * ═══ O QUE ESTA SPEC MEDE, E POR QUE ELA EXISTE ═══
 *
 * Houve uma moldura clara por trás do logo ENVIADO por quem hospeda quando o
 * tema era escuro (`dark:bg-white`), para arte escura não sumir contra
 * `--color-surface` (`#1d1c17`). O chip resolvia o contraste e criava outro
 * defeito visível: um bloco branco em volta do PNG, no menu lateral e — no
 * celular, onde o tema segue o do sistema — na faixa da marca da home. O dono
 * pediu o PNG como ele é; a moldura saiu de todas as superfícies.
 *
 * O custo, declarado: arte escura agora precisa vir preparada para os dois
 * temas. Nada no app clareia o fundo por conta própria.
 *
 * A cerca de FONTE para essa decisão é `tests/unit/logo-sem-moldura.test.ts`.
 * Esta spec é a medição no NAVEGADOR: ela abre a tela, escolhe o tema como uma
 * pessoa escolhe, e pergunta ao Chromium qual cor foi pintada atrás do logo —
 * uma classe escrita no JSX e uma classe que o Tailwind de fato compilou para o
 * seletor de tema (`@custom-variant dark (&:where([data-theme="dark"], …))`,
 * `app/globals.css`) são coisas diferentes, e só a segunda pinta pixel.
 *
 * ═══ A FRONTEIRA QUE CONTINUA VALENDO ═══
 *
 *   - logo ENVIADO por quem hospeda  → desenhado cru, nos dois temas
 *   - arte do PRODUTO (`marcaDoProduto`) → `<svg>` inline, sem moldura nenhuma
 *
 * O caso (5) guarda a fronteira: pôr moldura na marca do produto seria dar o
 * remédio a quem não tem a doença e quebraria o visual consolidado.
 *
 * ═══ A CONDIÇÃO DO DONO É MENSURÁVEL, E O CASO (6) A MEDE ═══
 *
 * "Não quebrar o que já existe" tem um sentido geométrico exato para quem NÃO
 * enviou logo: o cabeçalho da barra lateral tem de ocupar o MESMO retângulo que
 * ocupava. O caso (6) mede `getBoundingClientRect` nos dois temas e exige
 * igualdade — e grava os números em `evidence/` para que a comparação com um
 * build ANTERIOR seja aritmética, não impressão.
 *
 * ═══ AS QUATRO SUPERFÍCIES ═══
 *
 * São todas as que desenham o logo do operador, e precisam concordar — mudar
 * uma só devolve o defeito nas outras:
 *
 *   1. a barra lateral do app   (`components/shell/Sidebar.tsx`)   — casos 1,2,5,6
 *   2. a tela de entrada        (`app/(public)/layout.tsx`)        — caso 3
 *   3. a PRÉVIA da tela de marca(`components/branding/CampoDeLogo.tsx`) — caso 4
 *   4. a faixa da marca no celular (`components/inbox/InboxFilters.tsx`) — coberta
 *      pela cerca de fonte; aqui o tema do celular não é semeável sem viewport
 *      de dispositivo, e o caso 1 já mede o mesmo componente de marca no tema
 *      escuro.
 *
 * A terceira é a que mais engana: se a prévia mostrar um chip que o app real não
 * desenha, ela deixa de ser prévia — o operador aprova uma coisa na tela de
 * marca e recebe outra no produto.
 *
 * ═══ COMO O TEMA É ESCOLHIDO (e por que de dois jeitos) ═══
 *
 * Dentro de `/app/*` existe um controle de verdade — `ThemeToggle`
 * (`components/theme/theme-toggle.tsx`), dentro do `UserMenu` —, então lá o tema
 * é trocado CLICANDO, que é o caminho da pessoa.
 *
 * Em `/login` não há controle nenhum: a fachada é anterior à sessão. Lá o estado
 * é semeado em `localStorage` ANTES do primeiro byte (`addInitScript`), que é
 * exatamente o que o navegador de quem já escolheu escuro e saiu da conta faz —
 * `THEME_INIT_SCRIPT` (`app/layout.tsx:122`) lê `deskcomm-theme` no `<head>`.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

import { test, expect, type Page, type Locator } from "@playwright/test";

import { generateTotp, msUntilNextTotpWindow } from "./utils/totp";

const CREDS_PATH = path.join(process.cwd(), ".e2e-creds.json");
const EVIDENCIA = path.join(process.cwd(), "evidence", "logo-moldura-tema-escuro");

interface E2ECreds {
  password: string;
  org_id: string;
  users: Record<string, { id: string; email: string; role: string }>;
  admin_totp?: { factor_id: string; secret: string };
  dono_totp?: { factor_id: string; secret: string };
}

function loadCreds(): E2ECreds {
  const precisaSemear = (): boolean => {
    if (!fs.existsSync(CREDS_PATH)) return true;
    const c = JSON.parse(fs.readFileSync(CREDS_PATH, "utf8")) as E2ECreds;
    return !c.users?.dono || !c.dono_totp?.secret || !c.org_id;
  };
  if (precisaSemear()) {
    execFileSync("npx", ["tsx", "scripts/seed-e2e-credentials.ts"], { stdio: "inherit" });
  }
  // Promove `dono` a platform admin (e revoga a do `admin`) — idempotente. Sem
  // isto `/admin/marca` responde 403 e a spec mede a tela de recusa.
  execFileSync("npx", ["tsx", "scripts/seed-e2e-system-update.ts"], { stdio: "inherit" });
  return JSON.parse(fs.readFileSync(CREDS_PATH, "utf8")) as E2ECreds;
}

const creds = loadCreds();

// ── Um PNG de verdade, montado byte a byte ──────────────────────────────────
//
// Mesma construção de `marca-logo.spec.ts`, e pelo mesmo motivo: um base64
// colado no meio da spec é um blob que ninguém consegue auditar. A COR importa
// aqui — azul-marinho é a arte do relato original (o logo que sumia), e é
// justamente o pior caso contra `#1d1c17`.

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(tipo: string, dados: Buffer): Buffer {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, "latin1"), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tamanho, corpo, crc]);
}

function pngSolido(lado: number, cor: [number, number, number]): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0);
  ihdr.writeUInt32BE(lado, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  const linhas: Buffer[] = [];
  for (let y = 0; y < lado; y++) {
    const linha = Buffer.alloc(1 + lado * 3);
    for (let x = 0; x < lado; x++) {
      linha[1 + x * 3] = cor[0];
      linha[2 + x * 3] = cor[1];
      linha[3 + x * 3] = cor[2];
    }
    linhas.push(linha);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(linhas))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Azul-marinho: a arte do relato original — sem contraste contra `#1d1c17`. */
const PNG_AZUL_MARINHO = pngSolido(64, [16, 24, 64]);

// ── Medição ─────────────────────────────────────────────────────────────────

interface Caixa {
  readonly x: number;
  readonly y: number;
  readonly largura: number;
  readonly altura: number;
}

interface Moldura {
  /** A tag do elemento que embrulha o logo — o chip quando ele existir. */
  readonly tagDoPai: string;
  readonly classeDoPai: string;
  /** `getComputedStyle().backgroundColor` do pai — o que o NAVEGADOR pintou. */
  readonly fundo: string;
  /** [topo, direita, baixo, esquerda], em px. */
  readonly padding: readonly number[];
  readonly sombra: string;
  readonly raio: string;
  readonly caixaDoPai: Caixa;
  readonly caixaDoLogo: Caixa;
}

const px = (s: string): number => Number.parseFloat(s) || 0;

/**
 * Mede o elemento que EMBRULHA o logo — o pai direto, seja ele qual for.
 *
 * O seletor é deliberadamente cego à classe da moldura: perguntar por
 * `.dark\:bg-white` acharia o elemento pela classe que se quer provar — e o
 * contrário, procurar a AUSÊNCIA, ficaria refém do nome que o próximo merge
 * escolher. Partindo do `<img>` e subindo um nível, o que se mede é o que de fato
 * está atrás do logo. Com o chip removido, esse pai é o cabeçalho da barra, a
 * caixa da prévia ou o invólucro da fachada; se um chip voltar, ele é que passa a
 * ser medido — e o fundo claro dele reprova os casos abaixo.
 */
async function medirMoldura(logo: Locator): Promise<Moldura> {
  await expect(logo).toBeVisible({ timeout: 15_000 });
  const bruto = await logo.evaluate((el) => {
    const pai = el.parentElement as HTMLElement;
    const cs = getComputedStyle(pai);
    const rp = pai.getBoundingClientRect();
    const rl = el.getBoundingClientRect();
    return {
      tagDoPai: pai.tagName.toLowerCase(),
      classeDoPai: typeof pai.className === "string" ? pai.className : "",
      fundo: cs.backgroundColor,
      padding: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft],
      sombra: cs.boxShadow,
      raio: cs.borderRadius,
      caixaDoPai: { x: rp.x, y: rp.y, largura: rp.width, altura: rp.height },
      caixaDoLogo: { x: rl.x, y: rl.y, largura: rl.width, altura: rl.height },
    };
  });
  return { ...bruto, padding: bruto.padding.map(px) };
}

/** `rgb(r,g,b)` / `rgba(r,g,b,a)` → canais + alfa. `null` quando não é cor. */
function canais(cor: string): { r: number; g: number; b: number; a: number } | null {
  const m = cor.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?/);
  if (!m) return null;
  return { r: +m[1]!, g: +m[2]!, b: +m[3]!, a: m[4] === undefined ? 1 : +m[4]! };
}

/**
 * "Fundo claro" medido, não adjetivado: opaco E com os três canais altos.
 *
 * O limiar é 200/255 porque a moldura que saiu era `bg-white` puro (255) e o
 * `--color-surface` escuro é `#1d1c17` (29,28,23) — não há nada entre os dois
 * que este número precise arbitrar. Um logo azul-marinho desenhado cru sobre o
 * fundo escuro deixa o pai transparente, não claro: é isso que os casos cobram.
 */
function fundoEClaro(cor: string): boolean {
  const c = canais(cor);
  if (!c || c.a < 0.9) return false;
  return c.r >= 200 && c.g >= 200 && c.b >= 200;
}

/** Nenhum fundo pintado: o `rgba(0, 0, 0, 0)` que o Chromium devolve. */
function fundoETransparente(cor: string): boolean {
  const c = canais(cor);
  return c !== null && c.a === 0;
}

async function temaDaPagina(page: Page): Promise<string | null> {
  return page.evaluate(() => document.documentElement.getAttribute("data-theme"));
}

/**
 * Troca o tema CLICANDO no controle que a pessoa clica.
 *
 * `ThemeToggle` cicla claro → escuro → sistema → claro. O laço clica até o
 * `data-theme` do `<html>` ser o pedido, com teto: um controle que parou de
 * funcionar tem de reprovar aqui, não consumir o timeout do caso.
 */
async function escolherTemaPelaTela(page: Page, alvo: "dark" | "light"): Promise<void> {
  const botao = page.getByRole("button", { name: /^Tema:/ });
  await expect(botao, "o controle de tema não está na tela").toBeVisible({ timeout: 15_000 });
  for (let i = 0; i < 4; i++) {
    if ((await temaDaPagina(page)) === alvo) return;
    await botao.click();
    // O `setTheme` escreve o atributo no mesmo tick do clique; a espera curta é
    // para o repaint, não para a lógica.
    await page.waitForTimeout(150);
  }
  throw new Error(
    `o controle de tema não chegou em "${alvo}" em 4 cliques ` +
      `(data-theme=${await temaDaPagina(page)})`,
  );
}

type Escopo = "instalacao" | "organizacao";

async function loginComTotp(page: Page, email: string, secret: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: /entrar/i }).click({ timeout: 15_000 });
  await page.waitForURL(/\/login\/mfa/);

  const digito1 = page.locator('input[aria-label="Dígito 1"]');
  const recusa = page.locator("form").getByRole("alert");

  for (let tentativa = 0; tentativa < 2; tentativa++) {
    if (msUntilNextTotpWindow() < 3_000) await page.waitForTimeout(msUntilNextTotpWindow() + 200);
    await digito1.click({ timeout: 15_000 });
    await page.keyboard.type(generateTotp(secret), { delay: 40 });

    const desfecho = await Promise.race([
      page.waitForURL(/\/app\//, { timeout: 60_000 }).then(
        () => "entrou" as const,
        () => "sem-desfecho" as const,
      ),
      recusa.waitFor({ state: "visible", timeout: 60_000 }).then(
        () => "recusado" as const,
        () => "sem-desfecho" as const,
      ),
    ]);
    if (desfecho === "entrou") return;
    if (desfecho === "sem-desfecho") {
      throw new Error(`o desafio de MFA de ${email} não terminou em 60s (url=${page.url()})`);
    }
    await page.waitForTimeout(msUntilNextTotpWindow() + 200);
  }
  throw new Error(`MFA falhou depois de 2 tentativas para ${email} (url=${page.url()})`);
}

async function subir(
  page: Page,
  escopo: Escopo,
  arquivo: { nome: string; mime: string; bytes: Buffer },
): Promise<void> {
  // A HIDRATAÇÃO, e não a visibilidade: o input existe no HTML do SSR antes de o
  // React atar o `onChange`, e arquivo posto nessa janela não dispara requisição
  // nenhuma. Ver o comentário homônimo em `marca-logo.spec.ts`.
  await expect(
    page.locator(`[data-campo-de-logo='${escopo}'][data-hidratado]`),
    `o campo de logo da camada "${escopo}" não hidratou`,
  ).toBeVisible({ timeout: 15_000 });
  await page.locator(`#logo-${escopo}`).setInputFiles({
    name: arquivo.nome,
    mimeType: arquivo.mime,
    buffer: arquivo.bytes,
  });
  await expect(page.getByText(/logo atualizado/i)).toBeVisible({ timeout: 15_000 });
}

async function removerLogoSeHouver(page: Page, tela: string, escopo: Escopo): Promise<void> {
  await page.goto(tela);
  const remover = page
    .locator(`[data-campo-de-logo='${escopo}']`)
    .getByRole("button", { name: /^remover$/i });
  if ((await remover.count()) === 0) return;
  await remover.click();
  await expect(page.getByText(/logo removido/i)).toBeVisible({ timeout: 15_000 });
}

function evidencia(nome: string): string {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  return path.join(EVIDENCIA, nome);
}

/** Grava o número medido ao lado do screenshot: comparação vira aritmética. */
function anotar(nome: string, dado: unknown): void {
  fs.writeFileSync(evidencia(nome), JSON.stringify(dado, null, 2) + "\n", "utf8");
}

/** O cabeçalho da barra lateral: o primeiro filho do `<aside>` (`h-14`, `border-b`). */
function cabecalhoDaBarra(page: Page): Locator {
  return page.locator("aside > div").first();
}

async function medirCaixa(alvo: Locator): Promise<Caixa> {
  await expect(alvo).toBeVisible({ timeout: 15_000 });
  return alvo.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, largura: r.width, altura: r.height };
  });
}

// ── A spec ──────────────────────────────────────────────────────────────────

test.describe.configure({ mode: "serial" });

test.describe("o logo sem moldura, nos dois temas", () => {
  // Cada caso faz o próprio login: `mode: "serial"` encadeia ORDEM e estado do
  // BANCO, não a sessão do navegador (as fixtures `page`/`context` são de escopo
  // de teste). Ver o comentário longo em `marca-logo.spec.ts`.
  test.setTimeout(120_000);

  const secret = (): string => {
    const s = creds.dono_totp?.secret;
    expect(s, "sem `dono_totp` no .e2e-creds.json — rode seed-e2e-credentials.ts").toBeTruthy();
    return s!;
  };

  test("(1) tema ESCURO + logo ENVIADO: a barra lateral desenha o PNG cru", async ({ page }) => {
    await loginComTotp(page, creds.users.dono!.email, secret());

    await page.goto("/admin/marca");
    await subir(page, "instalacao", {
      nome: "logo-azul-marinho.png",
      mime: "image/png",
      bytes: PNG_AZUL_MARINHO,
    });

    await page.goto("/app/inbox");
    await escolherTemaPelaTela(page, "dark");
    expect(await temaDaPagina(page), "o <html> não ficou no tema escuro").toBe("dark");

    const logo = page.locator("aside img").first();
    const m = await medirMoldura(logo);
    anotar("1-barra-escuro.json", m);
    await page.screenshot({ path: evidencia("1-barra-escuro.png") });

    expect(
      fundoEClaro(m.fundo),
      `a barra lateral voltou a pintar uma moldura clara atrás do logo: ` +
        `background-color=${m.fundo} (tag=${m.tagDoPai}, classe="${m.classeDoPai}")`,
    ).toBe(false);
    expect(m.sombra, `apareceu uma sombra de chip atrás do logo: ${m.sombra}`).toBe("none");
    // E o que se mediu é o cabeçalho da barra, não um `<span>` de chip no meio:
    // com a moldura de volta, o pai do `<img>` passaria a ser o embrulho branco.
    expect(
      m.classeDoPai,
      `o logo está dentro de um elemento intermediário ("${m.classeDoPai}") — ` +
        `o cabeçalho da barra é o pai direto quando não há chip`,
    ).toContain("h-14");
    expect(m.caixaDoLogo.largura, "o logo não foi medido com largura").toBeGreaterThan(0);
  });

  test("(2) tema CLARO + logo ENVIADO: também sem moldura", async ({ page }) => {
    await loginComTotp(page, creds.users.dono!.email, secret());
    await page.goto("/app/inbox");
    await escolherTemaPelaTela(page, "light");
    expect(await temaDaPagina(page)).toBe("light");

    const m = await medirMoldura(page.locator("aside img").first());
    anotar("2-barra-claro.json", m);
    await page.screenshot({ path: evidencia("2-barra-claro.png") });

    expect(
      fundoETransparente(m.fundo),
      `no tema claro o logo ganhou fundo pintado (${m.fundo})`,
    ).toBe(true);
    expect(m.sombra, "no tema claro o logo ganhou sombra").toBe("none");
    expect(m.classeDoPai, "o logo saiu do pai direto no tema claro").toContain("h-14");
  });

  test("(3) a TELA DE ENTRADA repete as duas medidas, sem sessão nenhuma", async ({ browser }) => {
    // Contexto novo e deslogado: é o estado de quem só recebeu o endereço. O tema
    // é semeado antes do primeiro byte porque a fachada não tem controle — é o
    // que o navegador de quem escolheu escuro e saiu da conta já faz sozinho.
    for (const tema of ["dark", "light"] as const) {
      const contexto = await browser.newContext();
      try {
        const pagina = await contexto.newPage();
        await pagina.addInitScript((t) => window.localStorage.setItem("deskcomm-theme", t), tema);
        await pagina.goto("/login");
        expect(await temaDaPagina(pagina), `a fachada não ficou em ${tema}`).toBe(tema);

        const m = await medirMoldura(pagina.getByTestId("logo-da-fachada"));
        anotar(`3-fachada-${tema}.json`, m);
        await pagina.screenshot({ path: evidencia(`3-fachada-${tema}.png`) });

        expect(
          fundoEClaro(m.fundo),
          `a fachada no tema ${tema} pintou uma moldura clara atrás do logo ` +
            `(fundo=${m.fundo}, pai="${m.classeDoPai}")`,
        ).toBe(false);
        expect(m.sombra, `a fachada no tema ${tema} ganhou sombra de chip`).toBe("none");
        // O pai direto é o invólucro centralizador que já existia — não um chip.
        expect(m.classeDoPai, `a fachada no tema ${tema} embrulhou o logo`).toContain(
          "justify-center",
        );
      } finally {
        await contexto.close();
      }
    }
  });

  test("(4) a PRÉVIA da tela de marca prevê o que o app desenha — sem chip", async ({ page }) => {
    await loginComTotp(page, creds.users.dono!.email, secret());
    await page.goto("/admin/marca");

    // As duas caixas convivem no MESMO tema real (o fundo é simulado por
    // `style`), então lá a pergunta não é a cor do fundo — é ESTRUTURAL: com o
    // chip, o pai do `<img>` era o `<span>` branco; sem ele, o pai é a própria
    // caixa `[data-previa-do-logo]`.
    for (const caixa of ["escuro", "claro"] as const) {
      const img = page.locator(`[data-previa-do-logo='${caixa}'] img`);
      await expect(img).toBeVisible({ timeout: 15_000 });
      const semChip = await img.evaluate((el) =>
        el.parentElement?.hasAttribute("data-previa-do-logo"),
      );
      anotar(`4-previa-${caixa}.json`, { semChip });
      expect(
        semChip,
        `a prévia da aparência ${caixa} embrulha o logo num chip que o app não desenha — ` +
          `ela deixa de prever o que o operador recebe`,
      ).toBe(true);
    }
    await page.screenshot({ path: evidencia("4-previa.png"), fullPage: true });
  });

  test("(5) A FRONTEIRA: no escuro, a marca do PRODUTO não recebe moldura", async ({ page }) => {
    await loginComTotp(page, creds.users.dono!.email, secret());
    // Tira o logo enviado: sem ele, e com o nome padrão, a barra cai no ramo
    // `marcaDoProduto` — o `<svg>` inline desenhado para os dois temas.
    await removerLogoSeHouver(page, "/admin/marca", "instalacao");

    await page.goto("/app/inbox");
    await escolherTemaPelaTela(page, "dark");
    expect(await temaDaPagina(page)).toBe("dark");

    const barra = page.locator("aside").first();
    await expect(
      barra.locator("img"),
      "ainda há um <img> na barra — o logo enviado não foi removido, e o caso mediria outra coisa",
    ).toHaveCount(0, { timeout: 15_000 });

    const marca = barra.getByRole("img", { name: "DeskcommCRM" });
    await expect(
      marca,
      "a barra não caiu no ramo `marcaDoProduto` — sem ele não há fronteira para medir",
    ).toBeVisible({ timeout: 15_000 });

    // A negação é sobre TODA a cadeia entre a marca e o `<aside>`, e não só sobre
    // o pai: uma moldura acrescentada em qualquer avô pintaria igual na tela, e
    // uma asserção sobre um nível só passaria verde ao lado do defeito.
    const cadeia = await marca.evaluate((el) => {
      const saida: { tag: string; classe: string; fundo: string; padding: string }[] = [];
      let no = el as HTMLElement | null;
      while (no && no.tagName.toLowerCase() !== "aside") {
        const cs = getComputedStyle(no);
        saida.push({
          tag: no.tagName.toLowerCase(),
          classe: typeof no.className === "string" ? no.className : "",
          fundo: cs.backgroundColor,
          padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
        });
        no = no.parentElement;
      }
      return saida;
    });
    anotar("5-marca-do-produto-escuro.json", cadeia);
    await page.screenshot({ path: evidencia("5-marca-do-produto-escuro.png") });

    const comMoldura = cadeia.filter((n) => fundoEClaro(n.fundo));
    expect(
      comMoldura,
      `a marca do PRODUTO ganhou moldura clara no tema escuro — é o remédio dado a quem ` +
        `não tem a doença, e quebra o visual que já existia: ${JSON.stringify(comMoldura)}`,
    ).toEqual([]);
  });

  test("(6) A CONDIÇÃO DO DONO: sem logo enviado, o cabeçalho não muda de retângulo", async ({
    page,
  }) => {
    await loginComTotp(page, creds.users.dono!.email, secret());
    await page.goto("/app/inbox");

    await escolherTemaPelaTela(page, "light");
    const claro = await medirCaixa(cabecalhoDaBarra(page));
    await page.screenshot({ path: evidencia("6-cabecalho-claro.png") });

    await escolherTemaPelaTela(page, "dark");
    const escuro = await medirCaixa(cabecalhoDaBarra(page));
    await page.screenshot({ path: evidencia("6-cabecalho-escuro.png") });

    anotar("6-cabecalho-sem-logo.json", { claro, escuro });

    // A igualdade é o sentido geométrico exato de "não quebra o que já existe"
    // para quem NUNCA enviou logo: a moldura é do outro ramo, e nenhum pixel do
    // cabeçalho dessa instalação pode se mover ao trocar de tema.
    expect(
      escuro,
      `o cabeçalho da barra MUDOU de retângulo entre os temas numa instalação SEM logo ` +
        `enviado — claro=${JSON.stringify(claro)} escuro=${JSON.stringify(escuro)}`,
    ).toEqual(claro);
    // E ele continua sendo o `h-14` de sempre, no topo: a igualdade acima passaria
    // se os DOIS tivessem mudado junto.
    expect(escuro.altura, "o cabeçalho deixou de ser `h-14` (56px)").toBe(56);
    expect(escuro.y, "o cabeçalho saiu do topo da barra").toBe(0);
  });

  /**
   * A restauração. Num `afterAll` porque ele roda mesmo quando um caso estoura —
   * medido: com A→B(estouro)→C, a ordem observada é ["A","B","afterAll"], ou
   * seja o hook rodou e o caso seguinte não. Deixar a limpeza num caso final a
   * transformaria em refém do caso anterior.
   */
  test.afterAll(async ({ browser }) => {
    const contexto = await browser.newContext();
    try {
      const pagina = await contexto.newPage();
      await loginComTotp(pagina, creds.users.dono!.email, secret());
      await removerLogoSeHouver(pagina, "/admin/marca", "instalacao");
    } finally {
      await contexto.close();
    }
  });
});
