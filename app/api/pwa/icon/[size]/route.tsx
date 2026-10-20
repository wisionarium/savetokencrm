import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

import { marcaEhADoProduto } from "@/lib/branding";
import { CORES_DA_MARCA, SIMBOLO } from "@/lib/branding/desenho";
import { letraDoIcone } from "@/lib/branding/icone";
import { marcaDaSaida, NEUTROS_DE_SAIDA } from "@/lib/branding/saida";

/**
 * O ÍCONE DO APP INSTALÁVEL — 192 e 512 px, desenhados em runtime com a marca
 * da instalação.
 *
 * ─── Por que uma rota, e não dois PNG em `public/` ──────────────────────────
 *
 * O `app/icon.tsx` resolve o mesmo problema para a ABA, mas tem tamanho fixo
 * (64×64) e a assinatura de metadata route não recebe o tamanho. O manifest
 * precisa de 192 e 512 exatos, e a marca é do BANCO — um arquivo estático
 * levaria o nome/cor de quem buildou para a VPS de todo revendedor. Então a
 * mesma geometria de `app/icon.tsx` (símbolo do produto quando a marca É a do
 * produto; cor + inicial quando alguém configurou a própria) é servida por
 * esta rota, parametrizada pelo tamanho.
 *
 * ─── `force-dynamic` pelo mesmo motivo do favicon ───────────────────────────
 *
 * Sem esta linha o `next build` desenharia o ícone UMA vez, com a marca de
 * quem buildou, e a imagem pré-buildada é a mesma para todos os clones. O
 * defeito é invisível em dev e na Vercel — só aparece na VPS do revendedor.
 *
 * ⚠️ `/api/pwa/icon/*` precisa estar em `PUBLIC_PATHS`
 * (`lib/auth/public-paths.ts`): o `proxy.ts` só dispensa caminho COM extensão,
 * e `/api/pwa/icon/192` não tem — sem a entrada, o manifest (que é público)
 * pediria o ícone e receberia 307 para `/login`.
 */

export const dynamic = "force-dynamic";

/** 60s casa com o cache do favicon e com o TTL da marca: quem troca a cor vê o ícone acompanhar. */
const CACHE = { "cache-control": "public, max-age=60, stale-while-revalidate=600" };

const TAMANHOS = new Set(["192", "512"]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size } = await params;
  if (!TAMANHOS.has(size)) {
    return new Response("Tamanho não suportado", { status: 404 });
  }
  const lado = Number(size);
  const marca = await marcaDaSaida(null);

  if (marcaEhADoProduto({ name: marca.nome, logoUrl: marca.logoUrl })) {
    // 78% da aresta: deixa o respiro que o recorte `maskable` do Android come
    // sem tocar no desenho — o mesmo cálculo do favicon.
    const desenho = Math.round(lado * 0.78);
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: NEUTROS_DE_SAIDA.fundo,
          }}
        >
          <svg viewBox={SIMBOLO.viewBox} width={desenho} height={desenho}>
            <g fill={CORES_DA_MARCA.claro.simbolo} transform={SIMBOLO.transform}>
              <path d={SIMBOLO.d} />
              <rect {...SIMBOLO.modulo} />
            </g>
          </svg>
        </div>
      ),
      { width: lado, height: lado, headers: CACHE },
    );
  }

  const letra = letraDoIcone(marca.nome);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: marca.accent,
          color: marca.accentFg,
          fontSize: Math.round(lado * 0.62),
        }}
      >
        {letra ?? ""}
      </div>
    ),
    { width: lado, height: lado, headers: CACHE },
  );
}
