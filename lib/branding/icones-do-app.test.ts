import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { iconesDoApp } from "@/lib/branding/icones-do-app";

/**
 * O ÍCONE QUE A PESSOA VÊ NA TELA DE INÍCIO — a marca da instalação, em PNG.
 *
 * Dois defeitos passam por aqui e nenhum outro gate pega:
 *
 *   1. o manifest apontar para arquivo que não existe (ou para a rota de
 *      inicial) numa instalação chamada Tecla — o usuário instala e recebe um
 *      "T" colorido, não a logo;
 *   2. o PNG existir com o tamanho errado. O navegador confia no `sizes` do
 *      manifest; um arquivo 256 declarado como 512 vira ícone borrado na tela
 *      de início e ninguém liga o defeito ao arquivo.
 *
 * Por isso o teste mede o CABEÇALHO do PNG (bytes 16–23) e não só a existência.
 */

function dimensoesDoPng(caminho: string): { largura: number; altura: number } {
  const bytes = readFileSync(join(process.cwd(), "public", caminho.replace(/^\//, "")));
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return {
    largura: bytes.readUInt32BE(16),
    altura: bytes.readUInt32BE(20),
  };
}

describe("iconesDoApp", () => {
  it("instalação Tecla sem logo usa os PNG da marca", () => {
    expect(iconesDoApp("Tecla", null)).toEqual({
      any192: "/marca/tecla-192.png",
      any512: "/marca/tecla-512.png",
      maskable512: "/marca/tecla-512-maskable.png",
      apple: "/marca/tecla-180.png",
    });
  });

  it("outra marca continua no desenho de inicial, em runtime", () => {
    expect(iconesDoApp("Minha Empresa", null)).toEqual({
      any192: "/api/pwa/icon/192",
      any512: "/api/pwa/icon/512",
      maskable512: "/api/pwa/icon/512",
      apple: "/api/pwa/icon/192",
    });
  });

  it("logo configurado vence o ativo da Tecla — a precedência é a da sidebar", () => {
    // Sem isto, quem subisse um logo próprio continuaria vendo a Tecla na tela
    // de início: a marca da INSTALAÇÃO, não a da organização.
    expect(iconesDoApp("Tecla", "https://exemplo.com/logo.png").any192).toBe(
      "/api/pwa/icon/192",
    );
  });

  it("todo PNG apontado existe, é PNG de verdade e tem o tamanho declarado", () => {
    const icones = iconesDoApp("Tecla", null);
    const esperado = [
      [icones.any192, 192],
      [icones.any512, 512],
      [icones.maskable512, 512],
      [icones.apple, 180],
    ] as const;

    for (const [caminho, lado] of esperado) {
      expect(dimensoesDoPng(caminho), `${caminho} fora de ${lado}×${lado}`).toEqual({
        largura: lado,
        altura: lado,
      });
    }
  });
});
