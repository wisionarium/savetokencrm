import { describe, expect, it } from "vitest";

import { idsEmRisco } from "@/lib/leads/radar-board";

const A = "11111111-1111-4000-8000-000000000001";
const B = "11111111-1111-4000-8000-000000000002";
const FUNIL = "22222222-2222-4000-8000-000000000001";
const OUTRO = "22222222-2222-4000-8000-000000000002";

describe("idsEmRisco (recorte do quadro do Radar)", () => {
  it("leva crítico e em risco, do funil", () => {
    const ids = idsEmRisco(
      [
        { id: A, pipeline_id: FUNIL, risk: "critico" },
        { id: B, pipeline_id: FUNIL, risk: "em_risco" },
      ],
      FUNIL,
    );
    expect([...ids].sort()).toEqual([A, B].sort());
  });

  it("em_voo fica de fora — a IA já prometeu voltar (contrato §3.3)", () => {
    const ids = idsEmRisco([{ id: A, pipeline_id: FUNIL, risk: "em_voo" }], FUNIL);
    expect(ids.size).toBe(0);
  });

  it("em_dia nunca entra", () => {
    const ids = idsEmRisco([{ id: A, pipeline_id: FUNIL, risk: "em_dia" }], FUNIL);
    expect(ids.size).toBe(0);
  });

  it("lead de outro funil não vaza para este quadro", () => {
    const ids = idsEmRisco([{ id: A, pipeline_id: OUTRO, risk: "critico" }], FUNIL);
    expect(ids.size).toBe(0);
  });

  it("sem itens, sem ids — e sem radar não quebra", () => {
    expect(idsEmRisco([], FUNIL).size).toBe(0);
    expect(idsEmRisco(null, FUNIL).size).toBe(0);
    expect(idsEmRisco(undefined, FUNIL).size).toBe(0);
  });
});
