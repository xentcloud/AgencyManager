import { Navigate, Outlet, createFileRoute } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from "convex/react";
import { api } from "@agency/backend/api";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export const Route = createFileRoute("/_app")({ component: AppLayout });

function AppLayout() {
  return (
    <>
      <AuthLoading><div className="p-8 text-muted-foreground">Loading…</div></AuthLoading>
      <Unauthenticated><Navigate to="/login" /></Unauthenticated>
      <Authenticated><SignedIn /></Authenticated>
    </>
  );
}

function SignedIn() {
  const me = useQuery(api.users.me);
  const needsBootstrap = useQuery(api.users.needsBootstrap);
  const bootstrap = useMutation(api.users.bootstrapAgency);
  if (me === undefined || needsBootstrap === undefined) return null;
  if (!me) return <Navigate to="/login" />;

  if (needsBootstrap) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Set up your agency</CardTitle>
            <CardDescription>You're the first user. Create the agency workspace and become its admin.</CardDescription>
          </CardHeader>
          <CardContent><Button onClick={() => bootstrap()}>Create agency workspace</Button></CardContent>
        </Card>
      </div>
    );
  }

  if (me.memberships.length === 0) {
    return <div className="p-8">Your account isn't linked to a business yet. Ask the agency to invite you.</div>;
  }

  return (
    <SidebarProvider>
      <AppSidebar name={me.name} isAgency={me.isAgency} />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4"><SidebarTrigger /></header>
        <main className="p-6"><Outlet /></main>
      </SidebarInset>
    </SidebarProvider>
  );
}
