import { LOGO_DA_TECLA, logoDaMarca } from "@/lib/branding";

/**
 * OS ÍCONES DO APP INSTALÁVEL — a marca que aparece na tela de início.
 *
 * ─── Por que o ícone da Tecla é ARQUIVO, e o das outras marcas é rota ───────
 *
 * `app/api/pwa/icon/[size]` desenha o ícone em runtime porque a marca vem do
 * banco: cor e inicial de quem configurou a própria. Isso funciona para marca
 * de texto, e NÃO serve para um logotipo — o desenho é arte, não dá para
 * reconstruir com um `<div>` e uma letra.
 *
 * A instalação chamada "Tecla" sem logo configurado tem uma arte própria, que
 * já vive em `public/marca/tecla.png` e é a mesma da home do celular. Aqui ela
 * é servida em PNG nos tamanhos que o Android e o iOS pedem, gerados a partir
 * daquele arquivo (não redimensionados a cada requisição).
 *
 * ─── `maskable` não é o mesmo arquivo ampliado ──────────────────────────────
 *
 * O Android recorta o ícone `maskable` num círculo de 80% da aresta. Servir o
 * mesmo desenho colado na borda comeria a marca; por isso `tecla-512-maskable`
 * tem o desenho menor (60%) sobre fundo OPACO — transparência vira preto no
 * recorte de alguns launchers. O `apple-touch-icon` segue a mesma regra: o iOS
 * não mascara, mas pinta de preto o que for transparente.
 *
 * ─── A precedência é a MESMA da sidebar ─────────────────────────────────────
 *
 * Quem decide é `logoDaMarca`: nome "Tecla" E sem logo configurado. Se a
 * instalação subir um logo próprio, os ícones voltam ao desenho de inicial —
 * não há como buscar URL arbitrária do banco para dentro de um ícone sem abrir
 * SSRF em cada abertura do manifest.
 */
export type IconesDoApp = {
  readonly any192: string;
  readonly any512: string;
  readonly maskable512: string;
  readonly apple: string;
};

const DA_TECLA: IconesDoApp = {
  any192: "/marca/tecla-192.png",
  any512: "/marca/tecla-512.png",
  maskable512: "/marca/tecla-512-maskable.png",
  apple: "/marca/tecla-180.png",
};

export function iconesDoApp(nome: string, logoUrl: string | null): IconesDoApp {
  if (logoDaMarca(nome, logoUrl) === LOGO_DA_TECLA) return DA_TECLA;

  return {
    any192: "/api/pwa/icon/192",
    any512: "/api/pwa/icon/512",
    maskable512: "/api/pwa/icon/512",
    // O iOS aceita 192 e reduz; o importante é ser opaco e quadrado.
    apple: "/api/pwa/icon/192",
  };
}
