"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  ConnectionLineType,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type EdgeMouseHandler,
  type NodeMouseHandler,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { estimateNodeSize, layoutFlowGraph, LAYOUT_NODE_WIDTH } from "@/lib/followup/auto-layout";
import { semAresta, semArestasDoNo, semNo } from "@/lib/followup/excluir-do-grafo";
import {
  toReactFlow,
  fromReactFlow,
  graphsEqual,
  toFlowNode,
  type RFNode,
  type RFEdge,
  type RFNodeData,
} from "@/lib/followup/graph-mappers";
import { conditionLabel } from "@/lib/followup/edge-condition-options";
import { nextSequenceId } from "@/lib/followup/next-sequence-id";
import {
  branchIdForCondition,
  conditionForBranch,
  nodeBranches,
  type FlowEdge,
  type FlowGraph,
  type NodeType,
} from "@/lib/followup/graph-schema";
import { rotuloDoRamo } from "@/lib/followup/rotulo-do-ramo";
import { useFollowupFlow, type FollowupFlowDetailRow } from "@/hooks/followup/useFollowupFlow";
import { useT } from "@/hooks/i18n/useT";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Plus,
  X,
  Eye,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  Sparkle,
} from "@/lib/ui/icons";
import { NodeConfigPanel } from "./NodeConfigPanel";
import { EdgeConfigPanel } from "./EdgeConfigPanel";
import { EtapasDoFluxoProvider, useEtapasDoFluxo } from "./EtapasDoFluxo";
import { NodePalette } from "./NodePalette";
import { PublishBar } from "./PublishBar";
import { QuickAddNodeMenu } from "./QuickAddNodeMenu";
import { NODE_VISUALS } from "./nodes/nodeVisuals";
import { TriggerNode } from "./nodes/TriggerNode";
import { WaitNode } from "./nodes/WaitNode";
import { ConditionNode } from "./nodes/ConditionNode";
import { ClassifyNode } from "./nodes/ClassifyNode";
import { MatchReplyNode } from "./nodes/MatchReplyNode";
import { RepeatNode } from "./nodes/RepeatNode";
import { ActionNode } from "./nodes/ActionNode";
import { EndNode } from "./nodes/EndNode";

const EMPTY_GRAPH: FlowGraph = { nodes: [], edges: [] };
const DND_MIME = "application/x-followup-node-type";

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  wait: WaitNode,
  condition: ConditionNode,
  ai_classify: ClassifyNode,
  match_reply: MatchReplyNode,
  repeat: RepeatNode,
  action: ActionNode,
  end: EndNode,
};

interface Props {
  flowId: string;
  initialData: FollowupFlowDetailRow;
}

function FlowCanvasInner({ flowId, initialData }: Props) {
  const t = useT();
  const { nomes } = useEtapasDoFluxo();
  const { data: flow } = useFollowupFlow(flowId, { initialData });
  const initial = useMemo(
    () => toReactFlow(initialData.draft_graph ?? EMPTY_GRAPH),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RFEdge>(initial.edges);
  const [savedGraph, setSavedGraph] = useState<FlowGraph>(initialData.draft_graph ?? EMPTY_GRAPH);
  const nextId = useRef(nextSequenceId(initial.nodes.map((node) => node.id)));
  const nextEdgeId = useRef(nextSequenceId(initial.edges.map((edge) => edge.id)));
  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Controle de arrasto para o vazio (estilo Manychat Quick Add)
  const connectingRef = useRef<{
    nodeId: string;
    handleId: string | null;
    handleType: string | null;
  } | null>(null);

  const [quickAddMenu, setQuickAddMenu] = useState<{
    sourceNodeId: string | null;
    sourceHandleId: string | null;
    flowPosition: { x: number; y: number };
    screenPosition: { x: number; y: number };
  } | null>(null);

  const liveGraph = useMemo(() => fromReactFlow(nodes, edges), [nodes, edges]);
  const dirty = useMemo(() => !graphsEqual(liveGraph, savedGraph), [liveGraph, savedGraph]);

  const markNodeErrors = useCallback(
    (errorsByNode: Record<string, string[]>) => {
      setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, errors: errorsByNode[n.id] } })));
    },
    [setNodes],
  );
  const clearNodeErrors = useCallback(() => {
    setNodes((nds) => nds.map((n) => (n.data.errors ? { ...n, data: { ...n.data, errors: undefined } } : n)));
  }, [setNodes]);

  const onNodeClick = useCallback<NodeMouseHandler<RFNode>>((_, node) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  }, []);
  const onEdgeClick = useCallback<EdgeMouseHandler<RFEdge>>((_, edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, []);
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setQuickAddMenu(null);
  }, []);

  const updateNodeData = useCallback(
    (id: string, patch: Partial<RFNodeData>) => {
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
    },
    [setNodes],
  );
  const updateEdgeCondition = useCallback(
    (id: string, condition: FlowEdge["condition"]) => {
      setEdges((eds) =>
        eds.map((e) => (e.id === id ? { ...e, data: { priority: e.data?.priority ?? 0, condition } } : e)),
      );
    },
    [setEdges],
  );

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null;
  const selectedEdgeSource = selectedEdge ? (nodes.find((n) => n.id === selectedEdge.source) ?? null) : null;
  const selectedEdgeTarget = selectedEdge ? (nodes.find((n) => n.id === selectedEdge.target) ?? null) : null;

  const edgesForRender = useMemo(
    () =>
      edges.map((e) => {
        const condition = e.data?.condition ?? { type: "always" as const };
        const source = nodes.find((n) => n.id === e.source);
        const branch = source
          ? nodeBranches(toFlowNode(source)).find(
              (b) => b.id === branchIdForCondition(toFlowNode(source), condition),
            )
          : undefined;
        return {
          ...e,
          type: "smoothstep" as const,
          label: branch ? t(rotuloDoRamo(branch, nomes)) : t(conditionLabel(condition)),
          selected: e.id === selectedEdgeId,
        };
      }),
    [edges, nodes, selectedEdgeId, t, nomes],
  );

  const ramosLigadosDoSelecionado = useMemo(() => {
    if (!selectedNode) return [];
    const source = toFlowNode(selectedNode);
    return edges
      .filter((e) => e.source === selectedNode.id)
      .map((e) => branchIdForCondition(source, e.data?.condition ?? { type: "always" }))
      .filter((id): id is string => id !== null);
  }, [selectedNode, edges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const source = nodes.find((n) => n.id === connection.source);
      const fromBranch =
        source && connection.sourceHandle
          ? conditionForBranch(toFlowNode(source), connection.sourceHandle)
          : null;
      const newEdge: RFEdge = {
        id: `edge-${nextEdgeId.current++}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        data: { priority: 0, condition: fromBranch ?? { type: "always" } },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges, nodes],
  );

  const onConnectStart = useCallback(
    (_: unknown, params: { nodeId: string | null; handleId: string | null; handleType: string | null }) => {
      if (params.nodeId) {
        connectingRef.current = {
          nodeId: params.nodeId,
          handleId: params.handleId ?? null,
          handleType: params.handleType ?? null,
        };
      }
    },
    [],
  );

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      if (!connectingRef.current) return;
      const target = event.target as HTMLElement | null;
      const isPane = target?.classList.contains("react-flow__pane") || target?.closest(".react-flow__pane");

      if (isPane) {
        const clientX = "clientX" in event ? event.clientX : (event as TouchEvent).changedTouches?.[0]?.clientX ?? 0;
        const clientY = "clientY" in event ? event.clientY : (event as TouchEvent).changedTouches?.[0]?.clientY ?? 0;
        const flowPosition = screenToFlowPosition({ x: clientX, y: clientY });

        setQuickAddMenu({
          sourceNodeId: connectingRef.current.nodeId,
          sourceHandleId: connectingRef.current.handleId,
          flowPosition,
          screenPosition: { x: clientX, y: clientY },
        });
      }
      connectingRef.current = null;
    },
    [screenToFlowPosition],
  );

  const handleQuickAdd = useCallback(
    (type: NodeType, presetConfig?: Record<string, unknown>) => {
      if (!quickAddMenu) return;
      const { sourceNodeId, sourceHandleId, flowPosition } = quickAddMenu;
      const visual = NODE_VISUALS[type];
      const newNodeId = `${type}-${nextId.current++}`;
      const newNode: RFNode = {
        id: newNodeId,
        type,
        position: flowPosition,
        data: {
          label: t(visual.defaultLabel),
          config: (presetConfig ?? visual.defaultConfig()) as RFNodeData["config"],
        },
      };

      setNodes((nds) => nds.concat(newNode));

      if (sourceNodeId) {
        const sourceNode = nodes.find((n) => n.id === sourceNodeId);
        const fromBranch =
          sourceNode && sourceHandleId
            ? conditionForBranch(toFlowNode(sourceNode), sourceHandleId)
            : null;
        const newEdge: RFEdge = {
          id: `edge-${nextEdgeId.current++}`,
          source: sourceNodeId,
          target: newNodeId,
          sourceHandle: sourceHandleId,
          targetHandle: null,
          data: { priority: 0, condition: fromBranch ?? { type: "always" } },
        };
        setEdges((eds) => addEdge(newEdge, eds));
      }

      setSelectedNodeId(newNodeId);
      setSelectedEdgeId(null);
      setQuickAddMenu(null);
    },
    [quickAddMenu, nodes, setNodes, setEdges, t],
  );

  const isDispatchFlow = Boolean(initialData.inbox_enabled || flow?.inbox_enabled);

  const addNodeAt = useCallback(
    (type: NodeType, position: { x: number; y: number }, presetConfig?: Record<string, unknown>) => {
      const visual = NODE_VISUALS[type];
      const id = `${type}-${nextId.current++}`;
      const newNode: RFNode = {
        id,
        type,
        position,
        data: { label: t(visual.defaultLabel), config: (presetConfig ?? visual.defaultConfig()) as RFNodeData["config"] },
      };
      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes, t],
  );

  const onPaletteAdd = useCallback(
    (type: NodeType, presetConfig?: Record<string, unknown>) => {
      const index = nodes.length;
      addNodeAt(type, { x: 80 + (index % 4) * 220, y: 80 + Math.floor(index / 4) * 150 }, presetConfig);
    },
    [nodes.length, addNodeAt],
  );

  const deleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => semNo(nds, id));
      setEdges((eds) => semArestasDoNo(eds, id));
      setSelectedNodeId((cur) => (cur === id ? null : cur));
    },
    [setNodes, setEdges],
  );

  const deleteEdge = useCallback(
    (id: string) => {
      setEdges((eds) => semAresta(eds, id));
      setSelectedEdgeId((cur) => (cur === id ? null : cur));
    },
    [setEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData(DND_MIME) as NodeType;
      if (!type) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      let config: Record<string, unknown> | undefined;
      const configJson = event.dataTransfer.getData("application/x-followup-node-config");
      if (configJson) {
        try {
          config = JSON.parse(configJson) as Record<string, unknown>;
        } catch {
          // ignore
        }
      }
      addNodeAt(type, position, config);
    },
    [screenToFlowPosition, addNodeAt],
  );

  const autoLayout = useCallback(() => {
    if (nodes.length === 0) return;
    const sizes = new Map(
      nodes.map((node) => {
        const height = node.measured?.height ?? estimateNodeSize(toFlowNode(node)).height;
        return [node.id, { width: LAYOUT_NODE_WIDTH, height }];
      }),
    );
    const layout = layoutFlowGraph(liveGraph, sizes, nomes);
    const posMap = new Map(layout.nodes.map((n) => [n.id, n.position]));
    setNodes((nds) =>
      nds.map((node) => {
        const next = posMap.get(node.id);
        return next ? { ...node, position: next } : node;
      }),
    );
    setTimeout(() => fitView({ duration: 300, padding: 0.2 }), 50);
  }, [nodes, liveGraph, nomes, setNodes, fitView]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg">
      <PublishBar
        flowId={flowId}
        flow={flow ?? initialData}
        graph={liveGraph}
        dirty={dirty}
        selection={selectedNode ? "node" : selectedEdge ? "edge" : null}
        onDeleteSelection={() => {
          if (selectedNode) deleteNode(selectedNode.id);
          else if (selectedEdge) deleteEdge(selectedEdge.id);
        }}
        onSaved={(graph) => {
          setSavedGraph(graph);
          clearNodeErrors();
        }}
        onPublishErrors={markNodeErrors}
        onPublishSuccess={clearNodeErrors}
        onAutoFit={autoLayout}
        canAutoFit={nodes.length > 0}
      />

      <div className="relative flex flex-1 overflow-hidden" data-testid="flow-canvas">
        <Sheet open={paletteOpen} onOpenChange={setPaletteOpen}>
          <SheetContent side="left" className="w-72 max-w-[85vw] gap-0 p-0 lg:hidden">
            <SheetTitle className="sr-only">{t("Adicionar nó")}</SheetTitle>
            <NodePalette
              variant="mobile"
              isDispatchFlow={isDispatchFlow}
              onAdd={(type, presetConfig) => {
                onPaletteAdd(type, presetConfig);
                setPaletteOpen(false);
              }}
            />
          </SheetContent>
        </Sheet>

        <div className="relative h-full flex-1" data-testid="flow-canvas-viewport" onDragOver={onDragOver} onDrop={onDrop}>
          <ReactFlow
            nodes={nodes}
            edges={edgesForRender}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            defaultEdgeOptions={{ type: "smoothstep" }}
            connectionLineType={ConnectionLineType.SmoothStep}
            fitView={initial.nodes.length > 0}
            className="bg-bg/40"
          >
            {!isDispatchFlow && <Background gap={18} size={1} color="var(--color-border)" />}
          </ReactFlow>

          {/* Menu Contextual ao soltar no vazio ou clicar em '+' (Manychat style) */}
          {quickAddMenu && (
            <QuickAddNodeMenu
              position={quickAddMenu.screenPosition}
              onSelect={handleQuickAdd}
              onClose={() => setQuickAddMenu(null)}
              title={quickAddMenu.sourceNodeId ? t("Conectar próximo passo") : t("Novo passo")}
            />
          )}

          {/* Barra Flutuante de Controles Inferior Direita (Image 3 e 4) */}
          <div className="absolute bottom-6 right-6 z-30 flex items-center gap-2.5">
            <div className="flex items-center gap-1 rounded-2xl border border-border/80 bg-surface/90 p-1.5 shadow-xl backdrop-blur-md">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl text-text-muted hover:text-text hover:bg-muted transition-colors"
                onClick={() => fitView({ duration: 400 })}
                title={t("Ajustar visualização")}
              >
                <Eye size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl text-text-muted hover:text-text hover:bg-muted transition-colors"
                onClick={() => zoomIn({ duration: 300 })}
                title={t("Aumentar zoom")}
              >
                <MagnifyingGlassPlus size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl text-text-muted hover:text-text hover:bg-muted transition-colors"
                onClick={() => zoomOut({ duration: 300 })}
                title={t("Diminuir zoom")}
              >
                <MagnifyingGlassMinus size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl text-text-muted hover:text-text hover:bg-muted transition-colors"
                onClick={() => fitView({ duration: 400 })}
                title={t("Centralizar fluxo")}
              >
                <Sparkle size={16} />
              </Button>
            </div>

            {/* Botão FAB '+' azul vibrante estilizado Manychat */}
            <Button
              type="button"
              className="h-11 w-11 rounded-2xl bg-primary text-primary-foreground shadow-2xl transition-all duration-200 hover:scale-105 hover:bg-primary/90 active:scale-95"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setQuickAddMenu({
                  sourceNodeId: null,
                  sourceHandleId: null,
                  flowPosition: screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }),
                  screenPosition: { x: rect.left - 290, y: rect.top - 240 },
                });
              }}
              title={t("Adicionar novo passo")}
            >
              <Plus size={22} weight="bold" />
            </Button>
          </div>
        </div>

        {/* Drawer / Inspector Lateral (Estilo Image 4) */}
        {selectedNode && (
          <aside
            className="fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] flex-col overflow-hidden rounded-t-2xl border-t border-border bg-surface shadow-2xl lg:static lg:z-auto lg:h-full lg:w-96 lg:max-h-none lg:shrink-0 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none animate-in slide-in-from-right-4 duration-200"
            data-testid="node-config-sheet"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-text-muted">{t("Configurações do Passo")}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg text-text-muted hover:text-text hover:bg-muted"
                onClick={() => setSelectedNodeId(null)}
                aria-label={t("Fechar")}
              >
                <X size={16} aria-hidden />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <NodeConfigPanel
                key={selectedNode.id}
                node={selectedNode}
                onChange={(patch) => updateNodeData(selectedNode.id, patch)}
                onDelete={() => deleteNode(selectedNode.id)}
                ramosLigados={ramosLigadosDoSelecionado}
              />
            </div>
          </aside>
        )}

        {selectedEdge && (
          <aside
            className="fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] flex-col overflow-hidden rounded-t-2xl border-t border-border bg-surface shadow-2xl lg:static lg:z-auto lg:h-full lg:w-96 lg:max-h-none lg:shrink-0 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none animate-in slide-in-from-right-4 duration-200"
            data-testid="edge-config-sheet"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3">
              <span className="text-xs font-semibold text-text-muted">{t("Regra de Conexão")}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg text-text-muted hover:text-text hover:bg-muted"
                onClick={() => setSelectedEdgeId(null)}
                aria-label={t("Fechar")}
              >
                <X size={16} aria-hidden />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <EdgeConfigPanel
                key={selectedEdge.id}
                sourceNode={selectedEdgeSource ? toFlowNode(selectedEdgeSource) : undefined}
                targetNode={selectedEdgeTarget ? toFlowNode(selectedEdgeTarget) : undefined}
                condition={selectedEdge.data?.condition ?? { type: "always" }}
                onChange={(condition) => updateEdgeCondition(selectedEdge.id, condition)}
                onDelete={() => deleteEdge(selectedEdge.id)}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

export function FlowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <EtapasDoFluxoProvider>
        <FlowCanvasInner {...props} />
      </EtapasDoFluxoProvider>
    </ReactFlowProvider>
  );
}
