import { describe, expect, it } from "vitest";

import {
  dobrarAviso,
  EVENTO_DE_DIGITACAO,
  montarAvisoDeDigitacao,
  semExpirados,
  TETO_DE_DIGITACAO_MS,
  topicoDeDigitacao,
} from "@/lib/inbox/digitacao";

describe("digitação via broadcast", () => {
  it("tópico fixo por conversa — emissor e ouvinte casam pelo nome", () => {
    expect(topicoDeDigitacao("abc")).toBe("digitacao:abc");
    expect(topicoDeDigitacao("abc")).not.toMatch(/^private:/);
  });

  it("evento tem nome único", () => {
    expect(EVENTO_DE_DIGITACAO).toBe("digitacao");
  });

  it("aviso carrega quem, o quê e quando", () => {
    expect(montarAvisoDeDigitacao("u1", "Ana", "audio", 1000)).toEqual({
      user_id: "u1",
      nome: "Ana",
      kind: "audio",
      ts: 1000,
    });
  });

  it("expirado sai, fresco fica", () => {
    const agora = 10_000;
    const velho = montarAvisoDeDigitacao("u1", "Ana", "text", agora - TETO_DE_DIGITACAO_MS - 1);
    const fresco = montarAvisoDeDigitacao("u2", "Bia", "text", agora - 1000);
    expect(semExpirados([velho, fresco], agora)).toEqual([fresco]);
  });

  it("mesmo autor atualiza em vez de duplicar", () => {
    const a = montarAvisoDeDigitacao("u1", "Ana", "text", 1000);
    const b = montarAvisoDeDigitacao("u1", "Ana", "audio", 2000);
    const c = montarAvisoDeDigitacao("u2", "Bia", "text", 2000);
    expect(dobrarAviso([a, c], b)).toEqual([c, b]);
  });

  it("CONTROLE: teto de 6s com re-aviso de ~2,5s tolera um intervalo perdido", () => {
    // Sem este caso, alguém "otimiza" o teto para 2s e o indicador pisca.
    expect(TETO_DE_DIGITACAO_MS).toBeGreaterThan(2 * 2500);
  });
});
