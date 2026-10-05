import { describe, expect, it } from "vitest";

import { montarFiltrosDaLista } from "@/lib/inbox/montar-filtros";

/**
 * A CONGRUÊNCIA DOS FILTROS — cada controle da barra chega à query.
 *
 * A barra tem 6 controles (aba, busca, leitura, atribuído, canal, etiqueta) e
 * a query é montada num lugar só. Cada caso abaixo é uma combinação que o
 * operador monta clicando — e o que a lista pede ao servidor. Se um controle
 * passar a escrever um campo que ninguém lê, é aqui que vermelheia.
 */
describe("montarFiltrosDaLista — a matriz da barra", () => {
  it("Todas + atendente + não lidas: os três viajam juntos", () => {
    expect(
      montarFiltrosDaLista({}, { search: "", leitura: "nao_lidas", assigned_to: "uuid-1" }),
    ).toEqual({ assigned_to: "uuid-1", unread: true });
  });

  it("Minhas sem seletor: o dono da aba sobrevive", () => {
    expect(
      montarFiltrosDaLista({ assigned_to: "me", exclude_finished: true }, { search: "", leitura: "todas" }),
    ).toEqual({ assigned_to: "me", exclude_finished: true });
  });

  it("seletor VENCE o dono da aba (defensivo: a UI nem oferece, mas o contrato é explícito)", () => {
    expect(
      montarFiltrosDaLista({ assigned_to: "me" }, { search: "", leitura: "todas", assigned_to: "uuid-1" }),
    ).toMatchObject({ assigned_to: "uuid-1" });
  });

  it("Arquivadas + atendente + lidas: status da aba E os dois refinamentos", () => {
    expect(
      montarFiltrosDaLista({ status: "archived" }, { search: "", leitura: "lidas", assigned_to: "uuid-9" }),
    ).toEqual({ status: "archived", assigned_to: "uuid-9", read: true });
  });

  it("leitura 'todas' não liga nem unread nem read — `unread=false` seria ausência, não 'lidas'", () => {
    const f = montarFiltrosDaLista({}, { search: "", leitura: "todas" });
    expect(f.unread).toBeUndefined();
    expect(f.read).toBeUndefined();
  });

  it("busca curta não viaja (a rota recusaria e o hook mostraria erro)", () => {
    expect(montarFiltrosDaLista({}, { search: "a", leitura: "todas" }).search).toBeUndefined();
    expect(montarFiltrosDaLista({}, { search: "ana", leitura: "todas" }).search).toBe("ana");
  });

  it("canal e etiqueta passam direto", () => {
    expect(
      montarFiltrosDaLista({}, { search: "", leitura: "todas", channel_session_id: "c1", tag: "vip" }),
    ).toMatchObject({ channel_session_id: "c1", tag: "vip" });
  });

  it("CONTROLE: sem nada ligado, só a aba viaja", () => {
    expect(montarFiltrosDaLista({ comando: ["aguardando"] }, { search: "", leitura: "todas" })).toEqual({
      comando: ["aguardando"],
    });
  });
});
