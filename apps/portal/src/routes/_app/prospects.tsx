import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/prospects")({
  component: () => (
    <div className="grid gap-2">
      <h1 className="text-2xl font-semibold">Prospects</h1>
      <p className="text-muted-foreground">Coming in a later phase.</p>
    </div>
  ),
});
