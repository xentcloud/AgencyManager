import { Badge } from "@/components/ui/badge";

const labels: Record<string, { text: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  received: { text: "Received", variant: "outline" },
  queued: { text: "Queued for agent", variant: "secondary" },
  in_progress: { text: "Agent working", variant: "secondary" },
  preview_ready: { text: "Preview ready", variant: "default" },
  revising: { text: "Revising", variant: "secondary" },
  approved: { text: "Approved — deploying", variant: "default" },
  deployed: { text: "Live", variant: "outline" },
  needs_human: { text: "Needs attention", variant: "destructive" },
  rejected: { text: "Rejected", variant: "outline" },
  cancelled: { text: "Cancelled", variant: "outline" },
};

export function RequestState({ state }: { state: string }) {
  const l = labels[state] ?? { text: state, variant: "outline" as const };
  return <Badge variant={l.variant}>{l.text}</Badge>;
}
