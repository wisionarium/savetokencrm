import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

/**
 * Identidade visual Sage — a cerca contra o "vermelho genérico".
 *
 * Notificações (sonner), popups (dialog/alert/sheet) e avisos usavam cores
 * hardcoded do Tailwind (red-500, amber-50, blue-100…) e overlay preto puro,
 * cada tela com um vermelho diferente. A regra: estado sai dos tokens
 * (`success/warning/error/info`), overlay do token `--color-overlay`, e o
 * sonner tem skin própria em `globals.css` (o default dele é outro produto).
 */

const RAIZ = process.cwd();
const ler = (rel: string) => readFileSync(join(RAIZ, ...rel.split("/")), "utf8");

// Paleta hardcoded do Tailwind fora dos tokens. Neutros (slate/zinc/gray/
// neutral/stone) ficam DE FORA de propósito: há uso deliberado e medido
// (ex.: `bg-neutral-400` no skeleton da agenda, com contraste provado no
// comentário do arquivo). `text-white` no botão destrutivo é exceção
// declarada (a paleta prescreve fg branco sobre error).
const PALETA_FORA = /(text|bg|border)-(red|green|blue|amber|yellow|emerald|sky|purple|violet|indigo|orange|lime|rose|fuchsia|teal|cyan)-/;

function arquivosFonte(): string[] {
  const saida = execFileSync("git", ["ls-files", "app", "components", "lib", "hooks"], {
    cwd: RAIZ,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return saida.split("\n").filter((p) => /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p));
}

describe("identidade visual — sem paleta hardcoded", () => {
  it("nenhum tsx usa cor crua do Tailwind fora dos tokens", () => {
    const sujos = arquivosFonte().filter((rel) => {
      const texto = readFileSync(join(RAIZ, ...rel.split("/")), "utf8");
      return PALETA_FORA.test(texto);
    });
    expect(
      sujos,
      `cor hardcoded fora dos tokens (use success/warning/error/info):\n${sujos.join("\n")}`,
    ).toEqual([]);
  });

  it("overlays usam o token warm, nunca preto puro", () => {
    const comPreto = ["components/ui/dialog.tsx", "components/ui/alert-dialog.tsx", "components/ui/sheet.tsx"].filter(
      (rel) => ler(rel).includes("bg-black/"),
    );
    expect(comPreto, "overlay fora do --color-overlay").toEqual([]);
  });

  it("cards de modal/sheet sobem em surface com border do sistema", () => {
    for (const rel of ["components/ui/dialog.tsx", "components/ui/alert-dialog.tsx", "components/ui/sheet.tsx"]) {
      const texto = ler(rel);
      expect(texto, `${rel} sem bg-surface`).toContain("bg-surface");
      expect(texto, `${rel} sem border-border`).toContain("border-border");
    }
  });

  it("toasts têm skin Sage em globals.css (o default do sonner é outro produto)", () => {
    const css = ler("app/globals.css");
    expect(css.includes("[data-sonner-toast]")).toBe(true);
    for (const token of ["--color-error", "--color-success", "--color-warning", "--color-info"]) {
      const bloco = css.slice(css.indexOf("[data-sonner-toast]"));
      expect(bloco.includes(token), `skin do toast sem ${token}`).toBe(true);
    }
  });
});
