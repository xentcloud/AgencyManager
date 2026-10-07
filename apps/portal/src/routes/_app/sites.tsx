import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "@agency/backend/api";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_app/sites")({ component: Sites });

function Sites() {
  const sites = useQuery(api.sites.listAll);
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Sites</h1>
      <Table>
        <TableHeader>
          <TableRow><TableHead>Site</TableHead><TableHead>Customer</TableHead><TableHead>Core version</TableHead><TableHead>Status</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {sites?.map((s) => (
            <TableRow key={s._id}>
              <TableCell className="font-medium">{s.name}<div className="text-xs text-muted-foreground">site-{s.slug}</div></TableCell>
              <TableCell>{s.orgName}</TableCell>
              <TableCell>{s.coreVersion ?? "—"}</TableCell>
              <TableCell><Badge variant="secondary">{s.status}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
