import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/requests")({
  component: () => (
    <div className="grid gap-2">
      <h1 className="text-2xl font-semibold">Change requests</h1>
      <p className="text-muted-foreground">Coming in a later phase.</p>
    </div>
  ),
});
