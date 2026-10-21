import type { Metadata } from "next";

import { TelaMais } from "./_components/TelaMais";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mais" };

/**
 * A TELA "MAIS" DO CELULAR.
 *
 * Ela substitui o topo fixo que existia no celular e a gaveta antiga: conta,
 * preferências e o menu inteiro num lugar só, com endereço próprio. Abrir uma
 * gaveta escondia o conteúdo atrás de um gesto e não deixava link; aqui a
 * pessoa pode voltar com o X, com o botão do navegador ou pela barra de baixo.
 *
 * O desktop não usa esta tela: a partir de `md` a casca segue com sidebar e
 * TopBar, exatamente como era.
 */
export default function MaisPage() {
  return <TelaMais />;
}
