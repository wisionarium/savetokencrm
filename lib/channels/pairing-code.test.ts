import { describe, expect, it } from "vitest";

import { pairingPhoneSchema, requestChannelPairingCode, PairingCodeError } from "./pairing-code";

describe("pairing code boundary", () => {
  it("normalizes international phone and rejects non-phone input", () => {
    expect(pairingPhoneSchema.parse("+55 (11) 99999-1234")).toBe("5511999991234");
    for (const phone of ["abc5511999991234", "123", "01234567890", "1234567890123456"])
      expect(pairingPhoneSchema.safeParse(phone).success).toBe(false);
  });

  it("pairing indisponivel sem WAHA (oficial/parceiro nao usam codigo aqui)", async () => {
    await expect(
      requestChannelPairingCode(null as never, "org-a", "channel-a", "5511999991234"),
    ).rejects.toMatchObject({ code: "pairing_not_supported", status: 422 });
  });

  it("exporta PairingCodeError com code/status", () => {
    expect(new PairingCodeError("x", "y", 422)).toMatchObject({ code: "x", status: 422 });
  });
});
