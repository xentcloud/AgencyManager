import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "@agency/backend/api";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_app/")({ component: Dashboard });

function Dashboard() {
  const me = useQuery(api.users.me);
  const customers = useQuery(api.organizations.list);
  const stats = [
    { label: "Customers", value: customers?.length ?? "–" },
    { label: "Sites", value: customers?.reduce((n, c) => n + c.siteCount, 0) ?? "–" },
    { label: "Open requests", value: 0 },
  ];
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Welcome{me ? `, ${me.name}` : ""}</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader>
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-3xl">{s.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
