"use client";
// Thin wrapper so the canvas library is only loaded client-side (via next/dynamic)
// while still handing the graph instance back to the parent through `graphRef`.
import ForceGraph2D from "react-force-graph-2d";

export default function ForceGraph({ graphRef, ...props }) {
  return <ForceGraph2D ref={graphRef} {...props} />;
}
