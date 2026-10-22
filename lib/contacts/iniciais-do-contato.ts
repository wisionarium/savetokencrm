/**
 * As iniciais que o avatar desenha quando o contato não tem foto.
 *
 * Mora aqui, e não dentro de um componente, porque DUAS superfícies mostram a
 * mesma pessoa: a lista de conversas e o cabeçalho da conversa aberta. Duas
 * cópias da regra divergem no primeiro ajuste — e aí a mesma pessoa aparece
 * como "MA" na lista e "M" no cabeçalho, que é o tipo de inconsistência que
 * ninguém reporta e todo mundo estranha.
 *
 * Regra: primeiro nome + último sobrenome ("Maria da Silva" → "MS"); nome de
 * uma palavra só usa as duas primeiras letras ("Ana" → "AN"). Sem nome, cai
 * nos dois ÚLTIMOS dígitos do telefone — que é o que identifica a pessoa numa
 * conversa de WhatsApp sem contato salvo. Sem nada, "?".
 */
export function iniciaisDoContato(
  nome: string | null | undefined,
  telefone: string | null | undefined,
): string {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  const fallback = digitos.length >= 2 ? digitos.slice(-2) : "?";

  const limpo = (nome ?? "").trim();
  if (!limpo) return fallback;

  const partes = limpo.split(/\s+/).filter(Boolean);
  if (partes.length === 0) return fallback;
  if (partes.length === 1) return (partes[0] ?? "").slice(0, 2).toUpperCase();

  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes[partes.length - 1]?.[0] ?? "";
  return (primeira + ultima).toUpperCase() || fallback;
}
