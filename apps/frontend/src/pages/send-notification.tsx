import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Send, XCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { api, ApiRequestError } from "@/lib/api";
import { Contact, PaginatedResult, WhatsAppTemplate } from "@/lib/types";

export default function SendNotificationPage() {
  const [contactId, setContactId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ status: string; messageId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: contacts } = useQuery({
    queryKey: ["contacts-all-send"],
    queryFn: () => api.get<PaginatedResult<Contact>>("/contacts?pageSize=200"),
  });

  const { data: templates } = useQuery({
    queryKey: ["templates-approved"],
    queryFn: () => api.get<PaginatedResult<WhatsAppTemplate>>("/templates?status=APPROVED&pageSize=100"),
  });

  const selectedTemplate = templates?.items.find((t) => t.id === templateId);
  const selectedContact = contacts?.items.find((c) => c.id === contactId);

  const variableIndexes = useMemo(() => Array.from({ length: selectedTemplate?.variableCount ?? 0 }, (_, i) => String(i + 1)), [selectedTemplate]);

  const sendMutation = useMutation({
    mutationFn: () => api.post<{ status: string; messageId: string }>("/notifications/send", { contactId, templateId, variables }),
    onSuccess: (res) => {
      setResult(res);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : "Failed to send message"),
  });

  const preview = selectedTemplate?.body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, idx) => variables[idx] || `[var ${idx}]`);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Send Notification" description="Send a single WhatsApp message using an approved template." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Compose Message</CardTitle>
            <CardDescription>Select a recipient and an approved template.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Recipient</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger><SelectValue placeholder="Select a contact" /></SelectTrigger>
                <SelectContent>
                  {contacts?.items.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} &middot; {c.phone}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Template</Label>
              <Select
                value={templateId}
                onValueChange={(v) => {
                  setTemplateId(v);
                  setVariables({});
                  setResult(null);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select an approved template" /></SelectTrigger>
                <SelectContent>
                  {templates?.items.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                  {(templates?.items.length ?? 0) === 0 && (
                    <div className="px-2 py-2 text-xs text-muted-foreground">No approved templates available.</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {variableIndexes.length > 0 && (
              <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                <p className="text-sm font-medium">Template Variables</p>
                {variableIndexes.map((idx) => (
                  <div key={idx} className="flex flex-col gap-1.5">
                    <Label>Variable {"{{" + idx + "}}"}</Label>
                    <Input value={variables[idx] ?? ""} onChange={(e) => setVariables((v) => ({ ...v, [idx]: e.target.value }))} />
                  </div>
                ))}
              </div>
            )}

            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            {result && (
              <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${result.status === "FAILED" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                {result.status === "FAILED" ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                Message {result.status.toLowerCase()} &middot; ID: {result.messageId}
              </div>
            )}

            <Button
              disabled={!contactId || !templateId}
              loading={sendMutation.isPending}
              onClick={() => {
                setError(null);
                sendMutation.mutate();
              }}
            >
              <Send className="h-4 w-4" /> Send Message
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl bg-[#e5ded5] p-4">
              <div className="rounded-lg bg-white p-3 shadow-sm">
                <p className="whitespace-pre-wrap text-sm text-neutral-800">
                  {preview || "Select a template to preview the message."}
                </p>
                {selectedTemplate?.footer && <p className="mt-2 text-xs text-neutral-500">{selectedTemplate.footer}</p>}
              </div>
              {selectedContact && <p className="mt-2 text-center text-xs text-muted-foreground">To: {selectedContact.name} ({selectedContact.phone})</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
