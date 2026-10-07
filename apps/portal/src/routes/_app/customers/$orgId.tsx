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
  const connect = useMutation(api.sites.connect);
  const provision = useMutation(api.sites.provisionRepo);

  async function onConnect(siteId: Id<"sites">, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const repo = String(form.get("repo") || "") || undefined;
    const productionUrl = String(form.get("productionUrl") || "") || undefined;
    try {
      await connect({ siteId, repo, productionUrl });
      toast.success("Site updated");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    try {
      await createSite({ orgId, name: String(form.get("name")), slug: String(form.get("slug")) });
      formEl.reset();
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
            <div key={s._id} className="grid gap-3 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {s.repo ?? `site-${s.slug} (no repo yet)`} · {s.productKind}
                    {s.productionUrl && <> · <a className="underline" href={s.productionUrl} target="_blank" rel="noreferrer">{s.productionUrl}</a></>}
                  </div>
                </div>
                <Badge>{s.status}</Badge>
              </div>
              {s.status !== "live" && (!s.repo || s.repo === s.suggestedRepo) && (
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm" disabled={s.status === "building"}
                    onClick={() => provision({ siteId: s._id }).then(() => toast.success(`Creating ${s.suggestedRepo}…`), (err) => toast.error((err as Error).message))}>
                    {s.status === "building" ? "Creating repository…" : `Create ${s.suggestedRepo}`}
                  </Button>
                  <span className="text-sm text-muted-foreground">creates the repo from the template and deploys it — or connect an existing repo below</span>
                </div>
              )}
              {s.provisionError && <p className="text-sm text-destructive">{s.provisionError}</p>}
              <form onSubmit={(e) => onConnect(s._id, e)} className="flex flex-wrap items-end gap-2">
                <Input name="repo" defaultValue={s.repo ?? s.suggestedRepo} placeholder="owner/site-repo" className="w-56" />
                <Input name="productionUrl" defaultValue={s.productionUrl} placeholder="https://…" className="w-72" />
                <Button type="submit" variant="outline" size="sm">Save</Button>
              </form>
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
