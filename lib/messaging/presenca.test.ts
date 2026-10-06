import { describe, expect, it } from "vitest";

import { ancoraDeDigitandoValida } from "@/lib/messaging/presenca";

describe("ancoraDeDigitandoValida", () => {
  it("wamid passa — é o que a ingestão grava em external_id", () => {
    expect(ancoraDeDigitandoValida("wamid.HBgLMTY1MDM4Nzk0MzkVAg")).toBe(
      "wamid.HBgLMTY1MDM4Nzk0MzkVAg",
    );
  });

  it("id de outro canal não vira âncora da Meta", () => {
    expect(ancoraDeDigitandoValida("3EB0ABCDEF123456")).toBeNull();
  });

  it("ausência é silêncio, não erro", () => {
    expect(ancoraDeDigitandoValida(null)).toBeNull();
    expect(ancoraDeDigitandoValida(undefined)).toBeNull();
    expect(ancoraDeDigitandoValida("")).toBeNull();
  });

  it("CONTROLE: prefixo parecido mas errado não passa", () => {
    // Sem este caso, `includes("wamid")` passaria aqui e ancoraria lixo.
    expect(ancoraDeDigitandoValida("xwamid.abc")).toBeNull();
  });
});
