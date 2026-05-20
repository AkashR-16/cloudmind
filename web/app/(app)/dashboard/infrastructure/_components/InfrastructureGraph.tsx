"use client";

import { useState, useCallback, useMemo } from "react";
import {
  ReactFlow, Node, Edge, Background, Controls, MiniMap,
  BackgroundVariant, Handle, Position, NodeProps, MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useResources, ResourceNode } from "@/features/graph/useResources";
import { ResourcePanel } from "./ResourcePanel";
import { formatResourceKind } from "@/lib/utils";
import {
  Loader2, AlertCircle, RefreshCw, Server, HardDrive,
  Network, GitBranch, Shield, Key, Database, Zap, Globe, Cloud,
} from "lucide-react";

// ── Kind config ─────────────────────────────────────────────
const KIND_CONFIG: Record<string, { color: string; icon: React.ElementType; level: number }> = {
  aws_vpc:              { color: "#3b82f6", icon: Network,   level: 0 },
  aws_elb:              { color: "#ec4899", icon: Globe,     level: 1 },
  aws_subnet:           { color: "#8b5cf6", icon: GitBranch, level: 2 },
  aws_ec2_instance:     { color: "#22c55e", icon: Server,    level: 3 },
  aws_security_group:   { color: "#ef4444", icon: Shield,    level: 3 },
  aws_rds_instance:     { color: "#06b6d4", icon: Database,  level: 4 },
  aws_lambda_function:  { color: "#a855f7", icon: Zap,       level: 4 },
  aws_iam_role:         { color: "#f97316", icon: Key,       level: 5 },
  aws_s3_bucket:        { color: "#f59e0b", icon: HardDrive, level: 5 },
  aws_route53_zone:     { color: "#10b981", icon: Globe,     level: 5 },
};

function getKindConfig(kind: string) {
  return KIND_CONFIG[kind] ?? { color: "#6b7280", icon: Cloud, level: 3 };
}

// ── Custom node ──────────────────────────────────────────────
function ResourceNodeComponent({ data }: NodeProps) {
  const resource = data.resource as ResourceNode;
  const { color, icon: Icon } = getKindConfig(resource.kind);

  return (
    <>
      <Handle type="target" position={Position.Top}    style={{ background: color, width: 6, height: 6, border: "none" }} />
      <div
        className="flex flex-col items-center gap-1.5 py-3 px-3 rounded-xl cursor-pointer group transition-all duration-150"
        style={{
          background: "#111420",
          border: `1.5px solid ${color}40`,
          boxShadow: `0 0 0 0 ${color}00`,
          minWidth: 110,
          maxWidth: 150,
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLDivElement).style.border = `1.5px solid ${color}`;
          (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 16px -4px ${color}50`;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.border = `1.5px solid ${color}40`;
          (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0 0 ${color}00`;
        }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}18`, border: `1px solid ${color}35` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-[10px] font-medium text-white text-center leading-tight break-words w-full" style={{ maxWidth: 120 }}>
          {(resource.name ?? resource.id).replace(/^aws_/, "")}
        </span>
        <span className="text-[9px] text-gray-600 text-center">
          {formatResourceKind(resource.kind)}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: color, width: 6, height: 6, border: "none" }} />
    </>
  );
}

const NODE_TYPES = { resource: ResourceNodeComponent };

// ── Layout: hierarchical by kind level ──────────────────────
function buildFlowNodes(nodes: ResourceNode[]): Node[] {
  // Group by level
  const byLevel = new Map<number, ResourceNode[]>();
  for (const n of nodes) {
    const level = getKindConfig(n.kind).level;
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level)!.push(n);
  }

  const result: Node[] = [];
  const X_SPACING = 190;
  const Y_SPACING = 170;

  for (const [level, levelNodes] of byLevel.entries()) {
    // Sort by kind so same types cluster together
    levelNodes.sort((a, b) => a.kind.localeCompare(b.kind));
    const totalWidth = (levelNodes.length - 1) * X_SPACING;

    levelNodes.forEach((n, i) => {
      result.push({
        id: n.id,
        type: "resource",
        position: { x: i * X_SPACING - totalWidth / 2, y: level * Y_SPACING },
        data: { label: n.name ?? n.id, resource: n },
      });
    });
  }
  return result;
}

function buildFlowEdges(edges: Array<{ from: string; to: string; label?: string }>): Edge[] {
  return edges.map((e, i) => ({
    id: `e-${i}`,
    source: e.from.split("/").pop() ?? e.from,
    target: e.to.split("/").pop() ?? e.to,
    type: "smoothstep",
    style: { stroke: "#1e2235", strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#2a3044", width: 14, height: 14 },
  }));
}

// ── Legend ───────────────────────────────────────────────────
function Legend() {
  return (
    <div className="absolute top-4 left-4 z-10 bg-surface-card/90 backdrop-blur-md border border-white/[0.08] rounded-xl px-3 py-3 space-y-1.5 max-h-[calc(100vh-12rem)] overflow-y-auto">
      <p className="text-[9px] text-gray-500 uppercase tracking-wider font-medium mb-2">Resource types</p>
      {Object.entries(KIND_CONFIG).map(([kind, { color, icon: Icon }]) => (
        <div key={kind} className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
            <Icon className="w-2.5 h-2.5" style={{ color }} />
          </div>
          <span className="text-[10px] text-gray-400">{formatResourceKind(kind)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────
export function InfrastructureGraph() {
  const { data, isLoading, isError, refetch } = useResources();
  const [selectedResource, setSelectedResource] = useState<ResourceNode | null>(null);

  const flowNodes = useMemo(() => (data ? buildFlowNodes(data.nodes) : []), [data]);
  const flowEdges = useMemo(() => (data ? buildFlowEdges(data.edges) : []), [data]);

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    setSelectedResource(node.data.resource as ResourceNode);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-7rem)]">
        <div className="text-center space-y-3">
          <Loader2 className="w-7 h-7 animate-spin text-brand-500 mx-auto" />
          <p className="text-gray-400 text-sm">Loading infrastructure graph…</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-7rem)]">
        <div className="text-center space-y-4">
          <AlertCircle className="w-7 h-7 text-red-400 mx-auto" />
          <p className="text-gray-400 text-sm">Could not load graph. Is the agent running?</p>
          <button onClick={() => refetch()} className="flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300 mx-auto transition-colors">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-7rem)]">
        <div className="text-center space-y-3">
          <Network className="w-8 h-8 text-gray-600 mx-auto" />
          <p className="text-gray-400 text-sm">No resources discovered yet.</p>
          <p className="text-gray-600 text-xs">Run FixInventory against your Floci environment to populate the graph.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-[calc(100vh-7rem)]">
      <div className="flex-1 relative">
        <Legend />

        {/* Resource count + tip */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <div className="bg-surface-card/90 backdrop-blur-md border border-white/[0.08] rounded-xl px-3 py-2 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-gray-400">{data.total} resources</span>
          </div>
          <div className="bg-surface-card/90 backdrop-blur-md border border-white/[0.08] rounded-xl px-3 py-2">
            <span className="text-[10px] text-gray-500">Click any node to inspect</span>
          </div>
        </div>

        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={NODE_TYPES}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.15}
          maxZoom={2.5}
          style={{ background: "#0c0e18" }}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#1a2030" variant={BackgroundVariant.Dots} gap={24} size={1} />
          <Controls
            style={{
              background: "#111420",
              border: "1px solid #1e2235",
              borderRadius: 10,
            }}
          />
          <MiniMap
            style={{ background: "#0c0e18", border: "1px solid #1e2235", borderRadius: 10 }}
            nodeColor={(n) => getKindConfig((n.data?.resource as ResourceNode)?.kind ?? "").color}
            maskColor="rgba(12,14,24,0.7)"
          />
        </ReactFlow>
      </div>

      {selectedResource && (
        <ResourcePanel resource={selectedResource} onClose={() => setSelectedResource(null)} />
      )}
    </div>
  );
}
