import { useSyncExternalStore } from "react";

/**
 * ═══ ZOOM DO FIO DA CONVERSA ═══
 *
 * O corpo do fio nasce em `text-sm` = 17px (ver a escala tipográfica em
 * `app/globals.css`) e quem passa o dia lendo conversa é quem sabe o tamanho
 * que aguenta. O controle é a pílula flutuante no canto superior direito do
 * fio (`components/inbox/ZoomDoFio.tsx`), logo ABAIXO dos ícones de ligar e do
 * robô do cabeçalho — onde a mão já vai.
 *
 * Faixa de 80% a 140% em passos de 10%, com 90% de padrão (o dono pediu "menos
 * texto gritando por vez"). O zoom alcança só o fio: o compositor e o cabeçalho
 * ficam no tamanho padrão, senão o campo onde se escreve dançaria junto.
 *
 * A preferência é POR PESSOA e vive no `localStorage`: é conforto de quem lê,
 * não configuração da organização, e não deve viajar entre contas do mesmo
 * navegador.
 *
 * ═══ POR QUE EXTERNAL STORE (e não `useState`) ═══
 *
 * O valor real só existe no navegador (`localStorage`). `useState(() => ler())`
 * roda de novo na HIDRATAÇÃO e o React compararia um cliente em 80% contra um
 * servidor em 90% — a mesma classe de defeito que `lib/notifications/prefs.ts`
 * documenta. `useSyncExternalStore` com `getServerSnapshot` determinístico
 * resolve sem `setState` dentro de efeito (que o `react-hooks/set-state-in-effect`
 * recusa, corretamente).
 *
 * O snapshot é um NÚMERO primitivo, então dispensa o cache que `prefs.ts`
 * precisa: `Object.is` compara dois `number` iguais sem laço de re-render.
 */

export const ZOOM_MIN = 80;
export const ZOOM_MAX = 140;
export const ZOOM_PASSO = 10;
export const ZOOM_PADRAO = 90;

function chaveDeZoom(userId: string | null): string {
  return `inbox.zoom-do-fio.v1:${userId ?? "anon"}`;
}

/** Prende o valor à faixa e ao passo — o `localStorage` é entrada externa. */
export function normalizarZoom(valor: number): number {
  if (!Number.isFinite(valor)) return ZOOM_PADRAO;
  const noPasso = Math.round(valor / ZOOM_PASSO) * ZOOM_PASSO;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, noPasso));
}

export function lerZoom(userId: string | null): number {
  if (typeof window === "undefined") return ZOOM_PADRAO;
  try {
    const raw = window.localStorage.getItem(chaveDeZoom(userId));
    if (raw === null) return ZOOM_PADRAO;
    return normalizarZoom(Number.parseInt(raw, 10));
  } catch {
    return ZOOM_PADRAO;
  }
}

type OuvinteDeZoom = () => void;
const ouvintesDeZoom = new Set<OuvinteDeZoom>();

export function assinarZoom(ouvinte: OuvinteDeZoom): () => void {
  ouvintesDeZoom.add(ouvinte);
  return () => {
    ouvintesDeZoom.delete(ouvinte);
  };
}

export function gravarZoom(userId: string | null, valor: number): number {
  const proximo = normalizarZoom(valor);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(chaveDeZoom(userId), String(proximo));
    } catch {
      // modo privado / cota cheia — segue com o valor em memória da sessão
    }
  }
  for (const ouvinte of ouvintesDeZoom) ouvinte();
  return proximo;
}

/**
 * O valor do zoom para uma pessoa. `userId` é passado do layout (não lido de um
 * contexto próprio) para o hook continuar burro o bastante para testar.
 */
export function useZoomDoFio(userId: string | null): {
  zoom: number;
  aumentar: () => void;
  diminuir: () => void;
  podeAumentar: boolean;
  podeDiminuir: boolean;
} {
  const zoom = useSyncExternalStore(
    assinarZoom,
    () => lerZoom(userId),
    () => ZOOM_PADRAO,
  );
  return {
    zoom,
    aumentar: () => gravarZoom(userId, zoom + ZOOM_PASSO),
    diminuir: () => gravarZoom(userId, zoom - ZOOM_PASSO),
    podeAumentar: zoom < ZOOM_MAX,
    podeDiminuir: zoom > ZOOM_MIN,
  };
}
