import { describe, expect, it } from "vitest";

import { interpolateTemplate, cleanTemplateSymbols } from "@/lib/inbox/template-vars";

describe("interpolateTemplate", () => {
  it("substitui nome e primeiro_nome com {{}}", () => {
    expect(interpolateTemplate("Oi {{primeiro_nome}}, tudo bem?", { name: "Rafael Melgaço" })).toBe(
      "Oi Rafael, tudo bem?",
    );
    expect(interpolateTemplate("Falo com {{nome}}?", { name: "Rafael Melgaço" })).toBe(
      "Falo com Rafael Melgaço?",
    );
  });

  it("substitui variáveis modernas com @ (nome, primeiro_nome, telefone, email, empresa, tags)", () => {
    const contato = {
      name: "Maria Eduarda",
      phone_number: "+55 11 98888-7777",
      email: "maria@empresa.com",
      organization_name: "Acme Corp",
      tags: ["VIP", "Cliente Ativo"],
    };

    expect(interpolateTemplate("Olá @primeiro_nome, seu telefone é @telefone!", contato)).toBe(
      "Olá Maria, seu telefone é +55 11 98888-7777!",
    );
    expect(interpolateTemplate("Confirmo com @nome da empresa @empresa.", contato)).toBe(
      "Confirmo com Maria Eduarda da empresa Acme Corp.",
    );
    expect(interpolateTemplate("Seu e-mail é @email. Tags: @tags", contato)).toBe(
      "Seu e-mail é maria@empresa.com. Tags: VIP, Cliente Ativo",
    );
  });

  it("não corrompe endereços de e-mail normais que contêm @", () => {
    const contato = {
      name: "Carlos",
      email: "carlos@provedor.com",
    };
    expect(
      interpolateTemplate("Oi @primeiro_nome, mande um e-mail para suporte@savetoken.com ou @email.", contato),
    ).toBe("Oi Carlos, mande um e-mail para suporte@savetoken.com ou carlos@provedor.com.");
  });

  it("substitui colchetes [] legados", () => {
    expect(interpolateTemplate("Oi [primeiro_nome]!", { name: "Carlos Daniel" })).toBe("Oi Carlos!");
  });

  it("tolera espaços e case nas chaves", () => {
    expect(interpolateTemplate("Oi {{ Primeiro_Nome }}!", { name: "Ana Paula" })).toBe("Oi Ana!");
  });

  it("sem nome → mantém o literal (não quebra)", () => {
    expect(interpolateTemplate("Oi {{primeiro_nome}}", { name: null })).toBe("Oi {{primeiro_nome}}");
    expect(interpolateTemplate("Oi @primeiro_nome", { name: null })).toBe("Oi @primeiro_nome");
  });

  it("variável desconhecida → mantém o literal", () => {
    expect(interpolateTemplate("Cupom {{codigo}}", { name: "X" })).toBe("Cupom {{codigo}}");
    expect(interpolateTemplate("Cupom @codigo", { name: "X" })).toBe("Cupom @codigo");
  });
});

describe("cleanTemplateSymbols", () => {
  it("converte chaves e colchetes para @", () => {
    expect(cleanTemplateSymbols("Oi {{primeiro_nome}}, confirmo seu [telefone]?")).toBe(
      "Oi @primeiro_nome, confirmo seu @telefone?",
    );
    expect(cleanTemplateSymbols("Seu e-mail é {email} e empresa [[empresa]].")).toBe(
      "Seu e-mail é @email e empresa @empresa.",
    );
  });
});

