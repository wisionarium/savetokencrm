import { describe, expect, it } from "vitest";

import { flowGraphSchema } from "./graph-schema";
import {
  buildDispatchGraph,
  classifyDispatchMedia,
  DISPATCH_DEFAULT_DELAY_MS,
  DISPATCH_MAX_DELAY_MS,
  dispatchImagePreview,
  isDispatchPlaceholderBody,
  readDispatchDelay,
  readDispatchSpecifications,
  readDispatchSteps,
  resolveDispatchMedia,
} from "./dispatch-graph";

describe("buildDispatchGraph — o payload do editor de disparo", () => {
  it("atalho imagem+texto mantém 2 mensagens e passa no schema (regressão do 422)", () => {
    const graph = buildDispatchGraph({
      imageMediaUrl: "org-1/dispatch-flows/abc.jpg",
      specifications: "12x de R$ 825,00",
    });
    expect(flowGraphSchema.safeParse(graph).success).toBe(true);
    expect(graph.nodes.map((n) => n.type)).toEqual(["trigger", "action", "action", "end"]);
    expect(graph.nodes.some((n) => n.type === "wait")).toBe(false);
  });

  it("step com imagem+texto vira 1 mensagem com legenda", () => {
    const graph = buildDispatchGraph({
      steps: [{ imageMediaUrl: "org-1/dispatch-flows/abc.jpg", text: "12x de R$ 825,00" }],
    });
    expect(flowGraphSchema.safeParse(graph).success).toBe(true);
    expect(graph.nodes.map((n) => n.type)).toEqual(["trigger", "action", "end"]);
    const msg = graph.nodes[1]!;
    expect(msg.type).toBe("action");
    if (msg.type === "action" && msg.config.mode === "text") {
      expect(msg.config.body).toBe("12x de R$ 825,00");
      expect(msg.config.media_url).toBe("org-1/dispatch-flows/abc.jpg");
    } else {
      throw new Error("nó de mensagem fora do formato esperado");
    }
  });

  it("steps explícitos viram N mensagens em cadeia", () => {
    const graph = buildDispatchGraph({
      steps: [{ imageMediaUrl: "a.jpg", text: "legenda" }, { text: "texto longo" }],
    });
    expect(flowGraphSchema.safeParse(graph).success).toBe(true);
    expect(graph.nodes.map((n) => n.type)).toEqual(["trigger", "action", "action", "end"]);
    expect(graph.nodes[1]!.label).toBe("Mensagem #1");
  });

  it("legenda com imagem é fatiada em 1024; texto puro em 4000", () => {
    const graph = buildDispatchGraph({
      steps: [{ imageMediaUrl: "a.jpg", text: "x".repeat(2000) }],
    });
    const msg = graph.nodes[1]!;
    expect(msg.type).toBe("action");
    if (msg.type === "action" && msg.config.mode === "text") {
      expect(msg.config.body.length).toBe(1024);
    } else {
      throw new Error("nó de mensagem fora do formato esperado");
    }
  });

  it("só-texto e só-imagem também passam (sem nó vazio, sem wait)", () => {
    for (const g of [
      buildDispatchGraph({ specifications: "só texto" }),
      buildDispatchGraph({ imageMediaUrl: "org-1/dispatch-flows/a.jpg" }),
    ]) {
      expect(flowGraphSchema.safeParse(g).success).toBe(true);
      expect(g.nodes.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("readDispatchSteps lê a cadeia na ordem (legado de 2 nós inclusive)", () => {
    const legado = buildDispatchGraph({ specifications: "x" });
    expect(readDispatchSteps(legado).length).toBeGreaterThanOrEqual(1);
    const multi = buildDispatchGraph({
      steps: [{ imageMediaUrl: "a.jpg", text: "um" }, { text: "dois" }],
    });
    const steps = readDispatchSteps(multi);
    expect(steps.map((s) => s.text)).toEqual(["um", "dois"]);
    expect(steps[0]!.image).toBe("a.jpg");
    expect(readDispatchSteps(null)).toEqual([]);
  });
});

describe("intervalo digitando (dispatch_delay_ms no trigger)", () => {
  it("default 2600, editável, com clamp 0–30000, e passa no schema", () => {
    expect(readDispatchDelay(buildDispatchGraph({ specifications: "x" }))).toBe(
      DISPATCH_DEFAULT_DELAY_MS,
    );
    expect(readDispatchDelay(buildDispatchGraph({ specifications: "x", typingDelayMs: 30000 }))).toBe(
      DISPATCH_MAX_DELAY_MS,
    );
    expect(readDispatchDelay(buildDispatchGraph({ specifications: "x", typingDelayMs: 99999 }))).toBe(
      DISPATCH_MAX_DELAY_MS,
    );
    expect(readDispatchDelay(buildDispatchGraph({ specifications: "x", typingDelayMs: -3 }))).toBe(0);
    const g = buildDispatchGraph({ specifications: "x", typingDelayMs: 5000 });
    expect(flowGraphSchema.safeParse(g).success).toBe(true);
  });

  it("grafo legado (trigger com config {}) lê o default", () => {
    expect(readDispatchDelay({ nodes: [{ id: "t", type: "trigger", label: "t", position: { x: 0, y: 0 }, config: {} }], edges: [] })).toBe(
      DISPATCH_DEFAULT_DELAY_MS,
    );
    expect(readDispatchDelay(null)).toBe(DISPATCH_DEFAULT_DELAY_MS);
  });

  it("schema recusa delay acima de 30000 no trigger", () => {
    const g = buildDispatchGraph({ specifications: "x" });
    const trigger = g.nodes.find((n) => n.type === "trigger")!;
    const violado = {
      ...g,
      nodes: g.nodes.map((n) =>
        n.id === trigger.id ? { ...n, config: { dispatch_delay_ms: 30001 } } : n,
      ),
    };
    expect(flowGraphSchema.safeParse(violado).success).toBe(false);
  });

  it("wait de 2.6s continua recusado pelo schema (o piso existe de propósito)", () => {
    const graph = buildDispatchGraph({ specifications: "x" });
    const comWait = {
      ...graph,
      nodes: [
        ...graph.nodes,
        {
          id: "w",
          type: "wait" as const,
          label: "Aguardar 2.6s",
          position: { x: 0, y: 0 },
          config: { mode: "fixed" as const, duration_ms: 2600 },
        },
      ],
    };
    expect(flowGraphSchema.safeParse(comWait).success).toBe(false);
  });
});

describe("resolveDispatchMedia", () => {
  it("lê config.media_url (canônico do editor visual)", () => {
    const graph = buildDispatchGraph({ imageMediaUrl: "org-1/dispatch-flows/a.jpg" });
    const img = graph.nodes.find((n) => n.label === "Imagem do produto")!;
    expect(resolveDispatchMedia(img)).toEqual({ kind: "storage", path: "org-1/dispatch-flows/a.jpg" });
  });

  it("https vira url; http:/data: não trafegam como mídia", () => {
    expect(classifyDispatchMedia("https://cdn.exemplo.com/a.jpg")).toEqual({
      kind: "url",
      url: "https://cdn.exemplo.com/a.jpg",
    });
    expect(classifyDispatchMedia("http://cdn.exemplo.com/a.jpg")).toBeNull();
    expect(classifyDispatchMedia("data:image/jpeg;base64,AAA")).toBeNull();
    expect(classifyDispatchMedia("")).toBeNull();
  });

  it("lê legado data.media_storage_path quando não há media_url", () => {
    const graph = buildDispatchGraph({ specifications: "x" });
    const legado = {
      ...graph.nodes[0]!,
      id: "n_img",
      type: "action" as const,
      label: "Imagem do produto",
      position: { x: 0, y: 0 },
      config: { mode: "text" as const, body: "Imagem do produto" },
      data: { media_storage_path: "org-1/dispatch-flows/legado.jpg" },
    };
    expect(resolveDispatchMedia(legado)).toEqual({
      kind: "storage",
      path: "org-1/dispatch-flows/legado.jpg",
    });
    expect(dispatchImagePreview({ nodes: [legado], edges: [] })).toBeNull();
  });

  it("placeholder e URL no body não são legenda", () => {
    expect(isDispatchPlaceholderBody("Imagem do produto")).toBe(true);
    expect(isDispatchPlaceholderBody("https://x.com/a.jpg")).toBe(true);
    expect(isDispatchPlaceholderBody("12x de R$ 825,00")).toBe(false);
  });

  it("lê especificações e ignora placeholder", () => {
    const graph = buildDispatchGraph({
      imageMediaUrl: "org-1/dispatch-flows/a.jpg",
      specifications: "Motor 1000W",
    });
    expect(readDispatchSpecifications(graph)).toBe("Motor 1000W");
    expect(dispatchImagePreview(graph)).toBeNull();
    const comUrl = buildDispatchGraph({ imageMediaUrl: "https://cdn.exemplo.com/a.jpg" });
    expect(dispatchImagePreview(comUrl)).toBe("https://cdn.exemplo.com/a.jpg");
  });
});
