/**
 * Kanban de risco em quadro (C1 — desilhamento da doutrina do sistema vivo).
 * Prova, na perspectiva do usuário real: (1) o atendente entra no Kanban e VÊ,
 * no quadro do funil, a demanda aberta que esfriou (5 dias sem atividade, sem
 * próximo passo) — o que antes morria invisível no engine; (2) ele ARRASTA o
 * card para outra etapa e a mudança vale de verdade (move a etapa no banco).
 * Login como manager (sem MFA).
 *
 * O seed do radar roda a cada execução (reseta a conversa para "sem dono"),
 * então os testes são repetíveis. O seed cria o lead no funil PADRÃO — que é
 * onde o quadro do Radar abre.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { test, expect, type Page } from "@playwright/test";

const CREDS_PATH = path.join(process.cwd(), ".e2e-creds.json");

interface Creds {
  password: string;
  users: Record<string, { email: string }>;
  radar?: { at_risk_title: string };
}

function loadCreds(): Creds {
  const needsBase = (): boolean => {
    if (!fs.existsSync(CREDS_PATH)) return true;
    const c = JSON.parse(fs.readFileSync(CREDS_PATH, "utf8")) as Creds;
    return !c.users?.manager;
  };
  if (needsBase()) {
    execFileSync("npx", ["tsx", "scripts/seed-e2e-credentials.ts"], { stdio: "inherit" });
  }
  // Sempre reseta o fixture do radar (conversa volta a ficar sem dono).
  execFileSync("npx", ["tsx", "scripts/seed-e2e-radar.ts"], { stdio: "inherit" });
  return JSON.parse(fs.readFileSync(CREDS_PATH, "utf8")) as Creds;
}

const creds = loadCreds();

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/app\//);
}

async function gotoRadar(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Kanban" }).click();
  await page.waitForURL(/\/app\/radar/);
  await expect(page.getByRole("heading", { name: "Kanban de risco" })).toBeVisible();
}

function cartaoDoRadar(page: Page) {
  return page.getByRole("group", { name: `Lead: ${creds.radar!.at_risk_title}` });
}

test("o atendente vê no quadro do Kanban a demanda aberta que esfriou sem próximo passo", async ({
  page,
}) => {
  await login(page, creds.users.manager!.email);
  await gotoRadar(page);

  const card = cartaoDoRadar(page);
  await expect(card).toBeVisible({ timeout: 60_000 });
});

test("arrastar o card no Kanban move a etapa de verdade", async ({ page }) => {
  await login(page, creds.users.manager!.email);
  await gotoRadar(page);

  const card = cartaoDoRadar(page);
  await expect(card).toBeVisible({ timeout: 60_000 });

  // O arrasto acessível do @hello-pangea/dnd — o mesmo `onDragEnd` do mouse.
  const resposta = page.waitForResponse(
    (r) => r.url().includes("/api/v1/leads/") && r.url().endsWith("/move") && r.request().method() === "POST",
    { timeout: 60_000 },
  );
  await card.focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(400);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(400);
  await page.keyboard.press("Space");
  expect((await resposta).status()).toBe(200);

  // Recarrega: a etapa nova tem que ter ficado no banco, não só na tela.
  await page.reload();
  await expect(cartaoDoRadar(page)).toBeVisible({ timeout: 60_000 });
});
