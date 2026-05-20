"use client";

import { useQuery } from "@tanstack/react-query";

export interface ResourceNode {
  id: string;
  kind: string;
  name: string | null;
  region: string | null;
  account_id: string | null;
  tags: Record<string, string>;
  reported: Record<string, unknown>;
}

export interface GraphData {
  nodes: ResourceNode[];
  edges: Array<{ from: string; to: string; label?: string }>;
  total: number;
}

async function fetchResources(): Promise<GraphData> {
  const res = await fetch("/api/graph/resources");
  if (!res.ok) throw new Error("Failed to fetch graph data");
  return res.json();
}

export function useResources() {
  return useQuery<GraphData, Error>({
    queryKey: ["resources"],
    queryFn: fetchResources,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}
