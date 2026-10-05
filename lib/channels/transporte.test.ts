/**
 * O transporte de WhatsApp da instalacao, lido do ambiente.
 * Meta Cloud/Zernio (WAHA removido; legado WAHA ainda conta como apontado).
 */
import { describe, expect, it } from "vitest";

import { lerTransporteDeWhatsapp } from "@/lib/channels/transporte";

describe("o transporte de WhatsApp da instalacao", () => {
  it("ambiente vazio nao inventa nada", () => {
    expect(lerTransporteDeWhatsapp({})).toEqual({ apontado: false, comChave: false });
  });

  it("oficial (Meta) conta como transporte", () => {
    expect(
      lerTransporteDeWhatsapp({
        META_PHONE_NUMBER_ID: "123",
        META_SYSTEM_USER_TOKEN: "tok",
      }),
    ).toEqual({ apontado: true, comChave: true });
  });

  it("parceiro (Zernio) conta como transporte", () => {
    expect(lerTransporteDeWhatsapp({ ZERNIO_API_KEY: "k" })).toEqual({
      apontado: true,
      comChave: true,
    });
  });

  it("legado WAHA ainda conta como apontado (compat)", () => {
    expect(
      lerTransporteDeWhatsapp({
        WAHA_API_BASE_URL: "http://waha:3000",
        WAHA_API_KEY: "uma-chave-de-verdade",
      }),
    ).toEqual({ apontado: true, comChave: true });
  });

  it("espaco em branco nao e configuracao", () => {
    expect(lerTransporteDeWhatsapp({ META_SYSTEM_USER_TOKEN: "   " })).toEqual({
      apontado: false,
      comChave: false,
    });
  });
});
