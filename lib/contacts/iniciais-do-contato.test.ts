import { describe, expect, it } from "vitest";

import { iniciaisDoContato } from "@/lib/contacts/iniciais-do-contato";

/**
 * A regra das iniciais é UMA — lista e cabeçalho a consomem.
 *
 * O defeito que este arquivo impede: as duas telas mostrarem a mesma pessoa de
 * jeitos diferentes ("MS" na lista, "M" no cabeçalho) porque a regra foi
 * copiada. Aqui a regra é medida; os componentes só a chamam.
 */
describe("iniciaisDoContato", () => {
  it("primeiro nome + último sobrenome", () => {
    expect(iniciaisDoContato("Maria da Silva", null)).toBe("MS");
    expect(iniciaisDoContato("  Ana   Paula  Souza ", null)).toBe("AS");
  });

  it("nome de uma palavra usa duas letras", () => {
    expect(iniciaisDoContato("Ana", null)).toBe("AN");
    expect(iniciaisDoContato("Érica", null)).toBe("ÉR");
  });

  it("sem nome, cai nos dois últimos dígitos do telefone", () => {
    expect(iniciaisDoContato(null, "5511999999987")).toBe("87");
    expect(iniciaisDoContato("", "(11) 98888-1234")).toBe("34");
  });

  it("sem nome e sem telefone, não desenha string vazia", () => {
    // `AvatarFallback` vazio vira um círculo mudo — o "?" diz que falta dado.
    expect(iniciaisDoContato(null, null)).toBe("?");
    expect(iniciaisDoContato("   ", "")).toBe("?");
    expect(iniciaisDoContato(null, "1")).toBe("?");
  });

  it("contato identificado pelo telefone não herda letra de outro", () => {
    // Guarda de vacuidade do primeiro caso: o fallback do telefone não pode
    // ser substituído pela inicial de um nome inexistente.
    expect(iniciaisDoContato(null, "5511987654321")).toBe("21");
  });
});
