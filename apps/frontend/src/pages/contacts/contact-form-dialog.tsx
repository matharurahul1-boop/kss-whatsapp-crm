import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { api, ApiRequestError } from "@/lib/api";
import { Contact, ContactSource } from "@/lib/types";

export function ContactFormDialog({ open, onOpenChange, contact }: { open: boolean; onOpenChange: (open: boolean) => void; contact?: Contact | null }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!contact;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState<ContactSource>("MANUAL");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(contact?.name ?? "");
      setPhone(contact?.phone ?? "");
      setEmail(contact?.email ?? "");
      setSource(contact?.source ?? "MANUAL");
      setTags(contact?.tags.map((t) => t.name).join(", ") ?? "");
      setNotes(contact?.notes ?? "");
      setError(null);
    }
  }, [open, contact]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        phone,
        email: email || undefined,
        source,
        notes: notes || undefined,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      return isEdit ? api.put(`/contacts/${contact!.id}`, payload) : api.post("/contacts", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({ title: isEdit ? "Contact updated" : "Contact created", variant: "success" });
      onOpenChange(false);
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : "Something went wrong"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Contact" : "New Contact"}</DialogTitle>
          <DialogDescription>{isEdit ? "Update contact details." : "Add a new contact to your list."}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Full Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aarav Sharma" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Phone Number</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="919876543210" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Email (optional)</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="aarav@example.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Source</Label>
            <Select value={source} onValueChange={(v) => setSource(v as ContactSource)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["MANUAL", "CRM_API", "EXHIBITION", "WEBSITE", "IMPORT"] as const).map((s) => (
                  <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Tags (comma separated)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="VIP, Kitchen Project" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            loading={mutation.isPending}
            onClick={() => {
              setError(null);
              if (!name.trim() || !phone.trim()) {
                setError("Name and phone number are required.");
                return;
              }
              mutation.mutate();
            }}
          >
            {isEdit ? "Save Changes" : "Create Contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
