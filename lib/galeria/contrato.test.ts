import { describe, expect, it } from "vitest";

import {
  galeriaArquivoSchema,
  galeriaListQuerySchema,
  galeriaPastaCreateSchema,
  galeriaPatchSchema,
} from "./contrato";

describe("contrato da Galeria", () => {
  it("arquivo válido passa (com e sem preview)", () => {
    const base = {
      id: "11111111-1111-4111-8111-111111111111",
      storage_path: "org/x.jpg",
      nome: "x.jpg",
      mime: "image/jpeg",
      size_bytes: 10,
      largura: null,
      altura: null,
      origem: "chat",
      pasta_id: null,
      created_at: new Date().toISOString(),
    };
    expect(galeriaArquivoSchema.safeParse(base).success).toBe(true);
    expect(
      galeriaArquivoSchema.safeParse({ ...base, preview_url: "https://x/y" }).success,
    ).toBe(true);
    // inbound nunca é origem válida
    expect(galeriaArquivoSchema.safeParse({ ...base, origem: "inbound" }).success).toBe(false);
  });

  it("query de lista tem defaults e teto", () => {
    const parsed = galeriaListQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.limit).toBe(60);
      expect(parsed.data.offset).toBe(0);
    }
    expect(galeriaListQuerySchema.safeParse({ limit: 500 }).success).toBe(false);
  });

  it("patch exige algo para atualizar; pasta exige nome", () => {
    expect(galeriaPatchSchema.safeParse({}).success).toBe(false);
    expect(galeriaPatchSchema.safeParse({ nome: "nova" }).success).toBe(true);
    expect(galeriaPatchSchema.safeParse({ pasta_id: null }).success).toBe(true);
    expect(galeriaPastaCreateSchema.safeParse({ nome: "" }).success).toBe(false);
  });
});
