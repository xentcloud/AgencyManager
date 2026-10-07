import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@agency-manager/backend/api";
import type { Id } from "@agency-manager/backend/dataModel";
import { RequestState } from "@/components/request-state";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_app/requests/")({ component: Requests });

function NewRequest() {
  const me = useQuery(api.users.me);
  const sites = useQuery(api.sites.listMine);
  const create = useMutation(api.changeRequests.create);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [siteId, setSiteId] = useState<string>();
  const [agent, setAgent] = useState<"claude" | "codex">("claude");
  const [kind, setKind] = useState<"change" | "migrate">("change");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!siteId) return toast.error("Pick a site");
    setPending(true);
    try {
      const id = await create({
        siteId: siteId as Id<"sites">,
        summary: String(form.get("summary")),
        body: String(form.get("body")),
        agent,
        kind,
      });
      setOpen(false);
      navigate({ to: "/requests/$id", params: { id } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>New request</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a change</DialogTitle>
          <DialogDescription>An AI agent makes the change and sends you a preview to approve.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Site</Label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger><SelectValue placeholder="Choose a site" /></SelectTrigger>
              <SelectContent>
                {sites?.filter((s) => s.repo).map((s) => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="summary">What should change?</Label>
            <Input id="summary" name="summary" required maxLength={120} placeholder="Update Saturday hours" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="body">Details</Label>
            <Textarea id="body" name="body" rows={5} placeholder="We're now open Saturdays 9am–1pm starting next week." />
          </div>
          {me?.isAgency && (
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as "change" | "migrate")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="change">Change request</SelectItem>
                  <SelectItem value="migrate">Migration from an existing site (put its URL in Details)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {me?.isAgency && (
            <div className="grid gap-2">
              <Label>Agent</Label>
              <Select value={agent} onValueChange={(v) => setAgent(v as "claude" | "codex")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude">Claude Code</SelectItem>
                  <SelectItem value="codex">Codex</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <Button type="submit" disabled={pending}>Send request</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Requests() {
  const requests = useQuery(api.changeRequests.list, {});
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Change requests</h1>
        <NewRequest />
      </div>
      <Table>
        <TableHeader>
          <TableRow><TableHead>Request</TableHead><TableHead>Site</TableHead><TableHead>Status</TableHead><TableHead>Opened</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {requests?.map((r) => (
            <TableRow key={r._id}>
              <TableCell><Link to="/requests/$id" params={{ id: r._id }} className="font-medium hover:underline">{r.summary}</Link></TableCell>
              <TableCell>{r.siteName}</TableCell>
              <TableCell><RequestState state={r.state} /></TableCell>
              <TableCell className="text-muted-foreground">{new Date(r._creationTime).toLocaleString()}</TableCell>
            </TableRow>
          ))}
          {requests?.length === 0 && (
            <TableRow><TableCell colSpan={4} className="text-muted-foreground">No requests yet.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
