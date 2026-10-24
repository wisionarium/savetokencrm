/**
 * A base pública desta instalação — o endereço que o operador cola no painel da Meta.
 *
 * `env.*` e NÃO `process.env.NEXT_PUBLIC_APP_URL` direto: variáveis `NEXT_PUBLIC_`
 * são substituídas no BUILD, e a imagem genérica do self-host é construída com
 * `https://placeholder.invalid` (Dockerfile). Lendo direto do `process.env`, a tela
 * mostrava essa URL — e quem a colasse no dashboard apontaria o webhook para o nada,
 * sem erro em lugar nenhum.
 *
 * Existe como módulo porque três rotas passaram a precisar do mesmo endereço (a de
 * canal oficial, a de canal do parceiro e a de reaplicar o webhook): a cópia era o
 * defeito em potencial — duas telas dizendo URLs diferentes para o MESMO webhook.
 */
import { env } from "@/lib/env";

/** Aceita `NextRequest` e qualquer objeto com estas duas peças (testes). */
export function basePublicaDaInstalacao(req: { headers: Headers; nextUrl: URL }): string {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? (req.nextUrl.protocol ? req.nextUrl.protocol.replace(":", "") : "https");
  const hostUrl = origin ?? (host ? `${proto}://${host}` : null);

  const configurada = env.NEXT_PUBLIC_APP_URL;
  const usavel =
    configurada && !configurada.includes("placeholder.invalid") && !configurada.includes("localhost")
      ? configurada
      : null;

  // Se a requisição vem de um domínio público/remoto (não localhost), prioriza o domínio da própria requisição
  const base =
    (hostUrl && !hostUrl.includes("localhost") ? hostUrl : null) ??
    usavel ??
    configurada ??
    `${req.nextUrl.protocol}//${req.nextUrl.host}`;

  return base.replace(/\/+$/, "");
}
