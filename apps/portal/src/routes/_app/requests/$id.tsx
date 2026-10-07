import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { api } from "@agency-manager/backend/api";
import type { Id } from "@agency-manager/backend/dataModel";
import { RequestState } from "@/components/request-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_app/requests/$id")({ component: RequestDetail });

const eventText: Record<string, string> = {
  "request.created": "Request received",
  "issue.opened": "Queued for the agent",
  "pr.opened": "Agent proposed a change",
  "pr.updated": "Agent updated the change",
  "preview.ready": "Preview ready",
  "request.feedback": "Feedback sent",
  "request.approved": "Approved",
  "request.deployed": "Live on the website",
  "request.needs_human": "Needs attention",
  "agent.question": "Agent has a question",
  "agent.failed": "Agent couldn't finish — the agency will take over",
  "pr.closed_unmerged": "Change discarded",
};

function RequestDetail() {
  const id = Route.useParams().id as Id<"changeRequests">;
  const cr = useQuery(api.changeRequests.get, { id });
  const approve = useMutation(api.changeRequests.approve);
  const requestChanges = useMutation(api.changeRequests.requestChanges);
  const [feedback, setFeedback] = useState("");

  if (cr === undefined) return null;
  if (cr === null) return <p>Request not found.</p>;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); } catch (e) { toast.error((e as Error).message); }
  };
  const repoUrl = cr.site?.repo ? `https://github.com/${cr.site.repo}` : undefined;

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{cr.summary}</h1>
          <RequestState state={cr.state} />
        </div>
        <p className="text-sm text-muted-foreground">
          {cr.site?.name} · {cr.tier === "code" ? "Code change (agency review)" : "Content change"} · {cr.agent === "codex" ? "Codex" : "Claude Code"}
          {repoUrl && cr.issueNumber && <> · <a className="underline" href={`${repoUrl}/issues/${cr.issueNumber}`} target="_blank" rel="noreferrer">issue #{cr.issueNumber}</a></>}
          {repoUrl && cr.prNumber && <> · <a className="underline" href={`${repoUrl}/pull/${cr.prNumber}`} target="_blank" rel="noreferrer">PR #{cr.prNumber}</a></>}
        </p>
        {cr.body && <p className="whitespace-pre-wrap">{cr.body}</p>}
      </div>

      {cr.previewUrl && ["preview_ready", "revising", "approved", "deployed"].includes(cr.state) && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Check the change on a private copy of your site before it goes live.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Button asChild variant="outline" className="w-fit">
              <a href={cr.previewUrl} target="_blank" rel="noreferrer">Open preview <ExternalLink /></a>
            </Button>
            {cr.state === "preview_ready" && (
              <div className="grid gap-3">
                {cr.canApprove ? (
                  <Button className="w-fit" onClick={() => run(() => approve({ id }), "Approved — publishing now")}>Approve and publish</Button>
                ) : (
                  <p className="text-sm text-muted-foreground">This includes code changes; the agency reviews it before it goes live.</p>
                )}
                <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Or describe what to adjust…" rows={3} />
                <Button variant="secondary" className="w-fit" disabled={!feedback.trim()}
                  onClick={() => run(async () => { await requestChanges({ id, feedback }); setFeedback(""); }, "Sent to the agent")}>
                  Request changes
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {cr.lastError && <p className="text-sm text-destructive">{cr.lastError}</p>}

      <Card>
        <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
        <CardContent>
          <ol className="grid gap-3">
            {cr.timeline.map((e) => (
              <li key={e._id} className="flex gap-3 text-sm">
                <span className="w-40 shrink-0 text-muted-foreground">{new Date(e._creationTime).toLocaleString()}</span>
                <span>
                  {eventText[e.action] ?? e.action}
                  {e.action === "request.feedback" && e.data?.feedback && <span className="text-muted-foreground"> — “{e.data.feedback}”</span>}
                  {e.action === "pr.opened" && e.data?.summary && <span className="text-muted-foreground"> — {e.data.summary}</span>}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
