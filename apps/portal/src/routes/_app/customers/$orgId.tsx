import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@agency-manager/backend/api";
import type { Id } from "@agency-manager/backend/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/customers/$orgId")({ component: Customer });

function Customer() {
  const orgId = Route.useParams().orgId as Id<"organizations">;
  const org = useQuery(api.organizations.get, { orgId });
  const sites = useQuery(api.sites.listByOrg, { orgId });
  const createSite = useMutation(api.sites.create);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await createSite({ orgId, name: String(form.get("name")), slug: String(form.get("slug")) });
      e.currentTarget?.reset();
      toast.success("Site added");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (!org) return null;
  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{org.name}</h1>
        <Badge variant="secondary">{org.status}</Badge>
      </div>
      <Card>
        <CardHeader><CardTitle>Sites</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          {sites?.map((s) => (
            <div key={s._id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-sm text-muted-foreground">site-{s.slug} · {s.productKind}</div>
              </div>
              <Badge>{s.status}</Badge>
            </div>
          ))}
          <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3">
            <div className="grid gap-2"><Label htmlFor="name">Site name</Label><Input id="name" name="name" required /></div>
            <div className="grid gap-2"><Label htmlFor="slug">Slug</Label><Input id="slug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="smile-dental" /></div>
            <Button type="submit">Add site</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
