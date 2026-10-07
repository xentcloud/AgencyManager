import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@agency/backend/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_app/customers/")({ component: Customers });

function Customers() {
  const customers = useQuery(api.organizations.list);
  const create = useMutation(api.organizations.create);
  const [open, setOpen] = useState(false);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name"));
    try {
      await create({ name });
      setOpen(false);
      toast.success(`Added ${name}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>Add customer</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add customer</DialogTitle></DialogHeader>
            <form onSubmit={onCreate} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Business name</Label>
                <Input id="name" name="name" required />
              </div>
              <Button type="submit">Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader>
          <TableRow><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead>Sites</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {customers?.map((c) => (
            <TableRow key={c._id}>
              <TableCell><Link to="/customers/$orgId" params={{ orgId: c._id }} className="font-medium hover:underline">{c.name}</Link></TableCell>
              <TableCell><Badge variant="secondary">{c.status}</Badge></TableCell>
              <TableCell>{c.siteCount}</TableCell>
            </TableRow>
          ))}
          {customers?.length === 0 && (
            <TableRow><TableCell colSpan={3} className="text-muted-foreground">No customers yet.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
