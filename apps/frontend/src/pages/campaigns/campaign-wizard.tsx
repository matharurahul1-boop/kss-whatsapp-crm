import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { api, ApiRequestError } from "@/lib/api";
import { Campaign, CampaignAudienceType, Contact, ContactTag, PaginatedResult, WhatsAppTemplate } from "@/lib/types";

const STEPS = ["Details", "Audience", "Template", "Variables", "Review"] as const;

export default function CampaignWizardPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [audienceType, setAudienceType] = useState<CampaignAudienceType>("ALL");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [variableMap, setVariableMap] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const { data: tags } = useQuery({ queryKey: ["contact-tags"], queryFn: () => api.get<ContactTag[]>("/contacts/tags") });
  const { data: contacts } = useQuery({ queryKey: ["contacts-all-wizard"], queryFn: () => api.get<PaginatedResult<Contact>>("/contacts?pageSize=200") });
  const { data: templates } = useQuery({ queryKey: ["templates-approved-wizard"], queryFn: () => api.get<PaginatedResult<WhatsAppTemplate>>("/templates?status=APPROVED&pageSize=100") });

  const selectedTemplate = templates?.items.find((t) => t.id === templateId);
  const variableIndexes = useMemo(() => Array.from({ length: selectedTemplate?.variableCount ?? 0 }, (_, i) => String(i + 1)), [selectedTemplate]);

  const audiencePreview = useMemo(() => {
    if (!contacts) return [];
    if (audienceType === "ALL") return contacts.items;
    if (audienceType === "TAGS") return contacts.items.filter((c) => c.tags.some((t) => selectedTags.includes(t.name)));
    if (audienceType === "IMPORTED_LIST") return contacts.items.filter((c) => c.source === "IMPORT");
    return contacts.items.filter((c) => selectedContactIds.includes(c.id));
  }, [contacts, audienceType, selectedTags, selectedContactIds]);

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<Campaign>("/campaigns", {
        name,
        description: description || undefined,
        templateId,
        audience: {
          type: audienceType,
          tags: audienceType === "TAGS" ? selectedTags : undefined,
          contactIds: audienceType === "MANUAL_SELECTION" ? selectedContactIds : undefined,
        },
        variableMap,
      }),
    onSuccess: async (campaign) => {
      await api.post(`/campaigns/${campaign.id}/start`);
      toast({ title: "Campaign started", description: `"${campaign.name}" is now processing.`, variant: "success" });
      navigate(`/campaigns/${campaign.id}`);
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : "Failed to create campaign"),
  });

  function canProceed(): boolean {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return audiencePreview.length > 0;
    if (step === 2) return !!templateId;
    return true;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Create Campaign"
        description="Send a bulk WhatsApp notification to your contacts."
        actions={
          <Button variant="outline" onClick={() => navigate("/campaigns")}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        }
      />

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                i < step ? "bg-primary text-primary-foreground" : i === step ? "border-2 border-primary text-primary" : "border border-border text-muted-foreground"
              )}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={cn("whitespace-nowrap text-sm", i === step ? "font-medium" : "text-muted-foreground")}>{label}</span>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-border sm:w-10" />}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-5">
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Campaign Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Diwali Design Offer 2025" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Description (optional)</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Audience Type</Label>
                <Select value={audienceType} onValueChange={(v) => setAudienceType(v as CampaignAudienceType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Contacts</SelectItem>
                    <SelectItem value="TAGS">By Tags</SelectItem>
                    <SelectItem value="IMPORTED_LIST">Imported List</SelectItem>
                    <SelectItem value="MANUAL_SELECTION">Manual Selection</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {audienceType === "TAGS" && (
                <div className="flex flex-wrap gap-2">
                  {tags?.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => setSelectedTags((t) => (t.includes(tag.name) ? t.filter((x) => x !== tag.name) : [...t, tag.name]))}
                      type="button"
                    >
                      <Badge variant={selectedTags.includes(tag.name) ? "default" : "outline"}>{tag.name}</Badge>
                    </button>
                  ))}
                </div>
              )}

              {audienceType === "MANUAL_SELECTION" && (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                  {contacts?.items.map((c) => (
                    <label key={c.id} className="flex items-center gap-3 border-b border-border p-2.5 text-sm last:border-0 hover:bg-secondary/40">
                      <input
                        type="checkbox"
                        checked={selectedContactIds.includes(c.id)}
                        onChange={() => setSelectedContactIds((ids) => (ids.includes(c.id) ? ids.filter((x) => x !== c.id) : [...ids, c.id]))}
                      />
                      {c.name} <span className="text-muted-foreground">&middot; {c.phone}</span>
                    </label>
                  ))}
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{audiencePreview.length}</span> contacts match this audience.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Select an Approved Template</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger><SelectValue placeholder="Select a template" /></SelectTrigger>
                  <SelectContent>
                    {templates?.items.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedTemplate && (
                <div className="rounded-lg border border-border p-3 text-sm">
                  <p className="whitespace-pre-wrap">{selectedTemplate.body}</p>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">Map each template variable to a contact field, or enter a fixed value.</p>
              {variableIndexes.length === 0 && <p className="text-sm">This template has no variables.</p>}
              {variableIndexes.map((idx) => (
                <div key={idx} className="flex flex-col gap-1.5">
                  <Label>{"{{" + idx + "}}"}</Label>
                  <Select value={variableMap[idx] ?? "name"} onValueChange={(v) => setVariableMap((m) => ({ ...m, [idx]: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Contact Name</SelectItem>
                      <SelectItem value="phone">Contact Phone</SelectItem>
                      <SelectItem value="email">Contact Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-4">
              <SummaryRow label="Campaign Name" value={name} />
              <SummaryRow label="Template" value={selectedTemplate?.name ?? "-"} />
              <SummaryRow label="Audience Type" value={audienceType.replace("_", " ")} />
              <SummaryRow label="Recipients" value={String(audiencePreview.length)} />
              <div className="rounded-lg bg-[#e5ded5] p-4">
                <div className="rounded-lg bg-white p-3 shadow-sm">
                  <p className="whitespace-pre-wrap text-sm text-neutral-800">
                    {selectedTemplate?.body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, i) => `[${variableMap[i] ?? "name"}]`)}
                  </p>
                </div>
              </div>
              {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button disabled={!canProceed()} onClick={() => setStep((s) => s + 1)}>
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
            Start Campaign
          </Button>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
