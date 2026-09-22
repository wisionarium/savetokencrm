import type { FlowGraph, FlowNode } from "./graph-schema";

/**
 * Grafo de "fluxo de disparo" (inbox): trigger → [imagem] → [texto] → fim.
 *
 * Source of truth do formato que os escritores/leitores usam
 * (DispatchFlowEditor, FlowsList, editor visual via ActionForm, rota
 * dispatch-flow). Antes cada um montava/lia o grafo à mão e os três divergiram: o create mandava `wait` de 2.6s (o schema exige
 * piso de 5 min → 422 "Campos inválidos") e a rota de disparo lia a imagem
 * de `node.data.*`, que nenhum escritor produz — o canônico é
 * `config.media_url`, o mesmo campo que o ActionForm do editor visual lê e
 * escreve (e que sobrevive ao round-trip toReactFlow/fromReactFlow, que só
 * carrega `label` + `config`).
 *
 * Por que SEM nó `wait`: o intervalo de 2.6s entre imagem e texto é
 * garantido pela rota de disparo (`dispatch-flow/route.ts` aguarda 2.6s
 * entre os envios). Um nó `wait` de 2.6s seria recusado pelo schema
 * (piso 300_000ms, feito para follow-up automático com worker de 1/min);
 * um `wait` de 5 min seria aceito mas o disparo o limitaria a 5s —
 * nos dois casos o grafo mente sobre o que o disparo faz.
 */

/** Intervalo "digitando…" padrão entre imagem e texto no disparo manual. */
export const DISPATCH_DEFAULT_DELAY_MS = 2600;
/**
 * Teto do intervalo. 30s = parede do `apiClient` para mutações: acima disso
 * o navegador pode desistir da resposta (o envio continua no servidor).
 */
export const DISPATCH_MAX_DELAY_MS = 30000;
/** Rótulo estável do nó de imagem — usado para achar o nó em grafos legados. */
export const DISPATCH_IMAGE_LABEL = "Imagem do produto";
/** Rótulo estável do nó de especificações. */
export const DISPATCH_SPECS_LABEL = "Especificações";

/**
 * Placeholder de `body` do nó de imagem. O schema exige `body` não-vazio
 * em modo texto, mas o corpo real da mensagem-imagem é a mídia: a rota de
 * disparo NUNCA envia este texto como legenda (ver `isDispatchPlaceholderBody`).
 */
export const DISPATCH_IMAGE_PLACEHOLDER_BODY = "Imagem do produto";

/** Corpo é legenda de verdade quando não é placeholder nem URL. */
export function isDispatchPlaceholderBody(body: string): boolean {
  const v = body.trim();
  return (
    v === "" ||
    v === DISPATCH_IMAGE_PLACEHOLDER_BODY ||
    v.startsWith("http://") ||
    v.startsWith("https://") ||
    v.startsWith("data:")
  );
}

export type DispatchMedia =
  /** Caminho no bucket `whatsapp-media` (`<orgId>/dispatch-flows/...`). */
  | { kind: "storage"; path: string }
  /** URL pública (https) — enviada como link de mídia, sem passar pelo bucket. */
  | { kind: "url"; url: string };

function looksLikeUrl(v: string): boolean {
  return v.startsWith("http://") || v.startsWith("https://") || v.startsWith("data:");
}

/** Palpite de MIME pela extensão (o upload só aceita imagem; sem extensão, jpeg). */
export function guessDispatchMime(pathOrUrl: string): string {
  const clean = pathOrUrl.split("?")[0]?.toLowerCase() ?? "";
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

/** Classifica um valor bruto de mídia (storage path ou URL) sem validar rede. */
export function classifyDispatchMedia(raw: string): DispatchMedia | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.startsWith("https://")) return { kind: "url", url: v };
  if (looksLikeUrl(v)) return null; // http:/data: não trafegam como mídia
  if (v.length > 500) return null; // teto do sendMessageSchema.media_storage_path
  return { kind: "storage", path: v };
}

type LegacyNodeData = {
  data?: { media_storage_path?: string; preview_url?: string; media_mime?: string };
};

/**
 * Resolve a mídia do nó de imagem, lendo o formato canônico primeiro e os
 * legados depois (`data.*` dos dialogs antigos, `body` com URL
 * de grafos salvos à mão). Nunca lança.
 */
export function resolveDispatchMedia(node: FlowNode): DispatchMedia | null {
  if (node.type !== "action" || node.config.mode !== "text") return null;
  const candidates: unknown[] = [
    node.config.media_url,
    (node as unknown as LegacyNodeData).data?.media_storage_path,
    (node as unknown as LegacyNodeData).data?.preview_url,
    node.config.body,
  ];
  for (const c of candidates) {
    if (typeof c !== "string") continue;
    const classified = classifyDispatchMedia(c);
    if (classified) return classified;
  }
  return null;
}

/** Nó de imagem: pelo rótulo estável ou por ter mídia (passos `Mensagem #N`). */
export function findDispatchImageNode(graph: FlowGraph): FlowNode | undefined {
  return graph.nodes.find(
    (n) =>
      n.label === DISPATCH_IMAGE_LABEL ||
      (n.type === "action" && resolveDispatchMedia(n) !== null),
  );
}

/** URL de pré-visualização da mídia (lista, dialogs) — nunca lança. */
export function dispatchImagePreview(graph: FlowGraph | null | undefined): string | null {
  if (!graph?.nodes) return null;
  const img = findDispatchImageNode(graph);
  if (!img || img.type !== "action" || img.config.mode !== "text") return null;
  const legacy = img as unknown as LegacyNodeData;
  const preview = legacy.data?.preview_url;
  if (typeof preview === "string" && preview.trim()) return preview.trim();
  const media = resolveDispatchMedia(img);
  if (media?.kind === "url") return media.url;
  if (media?.kind === "storage") return media.path.startsWith("http") ? media.path : null;
  const body = img.config.body.trim();
  return body.startsWith("http") ? body : null;
}

/** Intervalo "digitando…" do grafo (ms). Ausente/inválido = 2600. Nunca lança. */
export function readDispatchDelay(graph: FlowGraph | null | undefined): number {
  const trigger = graph?.nodes.find((n) => n.type === "trigger");
  const raw =
    trigger && trigger.type === "trigger" ? trigger.config.dispatch_delay_ms : undefined;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0 || raw > DISPATCH_MAX_DELAY_MS) {
    return DISPATCH_DEFAULT_DELAY_MS;
  }
  return raw;
}

/** Texto de especificações (nó `Especificações`, ou o outro action do grafo). */
export function readDispatchSpecifications(graph: FlowGraph | null | undefined): string {
  if (!graph?.nodes) return "";
  const img = findDispatchImageNode(graph);
  const specs = graph.nodes.find(
    (n) => n.label === DISPATCH_SPECS_LABEL || (n.type === "action" && n !== img),
  );
  if (!specs || specs.type !== "action" || specs.config.mode !== "text") return "";
  const body = specs.config.body;
  return isDispatchPlaceholderBody(body) ? "" : body;
}

export interface DispatchStepInput {
  /** Storage path ou URL https da imagem do passo. */
  imageMediaUrl?: string;
  /** Texto do passo (legenda quando há imagem). */
  text?: string;
  /** Posição visual no canvas (arrasto persiste aqui). */
  position?: { x: number; y: number };
}

export function buildDispatchGraph(input: {
  /** Atalho legado: imagem única (vira 1 step). Prefira `steps`. */
  imageMediaUrl?: string;
  /** Atalho legado: texto único (vira 1 step). Prefira `steps`. */
  specifications?: string;
  /** Intervalo "digitando…" entre mensagens (ms, 0–30000, default 2600). */
  typingDelayMs?: number;
  /** Passos da mensagem, na ordem de envio. */
  steps?: DispatchStepInput[];
}): FlowGraph {
  const delay =
    input.typingDelayMs === undefined
      ? DISPATCH_DEFAULT_DELAY_MS
      : Math.min(DISPATCH_MAX_DELAY_MS, Math.max(0, Math.floor(input.typingDelayMs)));

  const steps: DispatchStepInput[] =
    input.steps ??
    (() => {
      const image = input.imageMediaUrl?.trim() ?? "";
      const specs = input.specifications?.trim() ?? "";
      const list: DispatchStepInput[] = [];
      if (image) list.push({ imageMediaUrl: image });
      if (specs) list.push({ text: specs });
      return list;
    })();

  const nodes: FlowGraph["nodes"] = [
    {
      id: "node_trigger",
      type: "trigger",
      label: "Disparo manual",
      position: { x: 100, y: 100 },
      config: { dispatch_delay_ms: delay },
    },
  ];
  const edgeTargets: string[] = [];
  const multi = steps.length > 1;

  steps.forEach((step, i) => {
    const image = step.imageMediaUrl?.trim() ?? "";
    const text = step.text?.trim() ?? "";
    if (!image && !text) return;
    const id = `node_step_${i + 1}`;
    const label = !multi
      ? image && !text
        ? DISPATCH_IMAGE_LABEL
        : DISPATCH_SPECS_LABEL
      : `Mensagem #${i + 1}`;
    // Legenda de imagem do WhatsApp tem teto curto: com imagem, o texto
    // vira legenda (1024); texto longo vive em passo só-texto (4000).
    const body = image ? text.slice(0, 1024) : text.slice(0, 4000);
    nodes.push({
      id,
      type: "action",
      label,
      position: step.position ?? { x: 100, y: 250 + nodes.length * 150 },
      config: {
        mode: "text",
        body: body || DISPATCH_IMAGE_PLACEHOLDER_BODY,
        ...(image ? { media_url: image.slice(0, 1000) } : {}),
      },
    });
    edgeTargets.push(id);
  });

  nodes.push({
    id: "node_end",
    type: "end",
    label: "Fim",
    position: { x: 100, y: 700 },
    config: { outcome: "converted" },
  });
  edgeTargets.push("node_end");

  const edges: FlowGraph["edges"] = [];
  let source = "node_trigger";
  edgeTargets.forEach((target, i) => {
    edges.push({
      id: `e${i + 1}`,
      source,
      target,
      condition: { type: "always" },
      priority: 0,
    });
    source = target;
  });

  return { nodes, edges };
}

export interface DispatchStep {
  /** Imagem para ENVIO (storage path ou https). Nunca vai num `<img>`. */
  image: string;
  /**
   * Imagem para EXIBIR (https ou URL assinada). Storage path cru quebra a
   * prévia — quem lê daqui para `<img>` usa este campo, nunca `image`.
   */
  preview: string;
  /** Texto/legenda ("" quando placeholder). */
  text: string;
  position: { x: number; y: number };
}

/**
 * Lê os passos na ordem da cadeia (arestas a partir do trigger; cai para
 * ordem dos nós). Pula trigger/fim/wait. Nunca lança.
 */
export function readDispatchSteps(graph: FlowGraph | null | undefined): DispatchStep[] {
  if (!graph?.nodes?.length) return [];
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const ordered: typeof graph.nodes = [];
  const trigger = graph.nodes.find((n) => n.type === "trigger");
  if (trigger) {
    const visited = new Set<string>([trigger.id]);
    let curr: string | undefined = trigger.id;
    while (curr) {
      const edge = graph.edges.find((e) => e.source === curr);
      if (!edge || visited.has(edge.target)) break;
      visited.add(edge.target);
      const next = byId.get(edge.target);
      if (!next) break;
      ordered.push(next);
      curr = next.id;
    }
  } else {
    ordered.push(...graph.nodes);
  }
  const steps: DispatchStep[] = [];
  for (const node of ordered) {
    if (node.type !== "action" || node.config.mode !== "text") continue;
    const media = resolveDispatchMedia(node);
    const image = media?.kind === "storage" ? media.path : media?.url ?? "";
    // https exibe direto; storage precisa de URL assinada (endpoint
    // /media/galeria/preview) — o chamador preenche.
    const preview = media?.kind === "url" ? media.url : "";
    const text = isDispatchPlaceholderBody(node.config.body) ? "" : node.config.body;
    if (!image && !text) continue;
    steps.push({ image, preview, text, position: { x: node.position.x, y: node.position.y } });
  }
  return steps;
}
