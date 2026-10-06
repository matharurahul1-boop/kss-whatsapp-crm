import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MessageCircle, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { api, ApiRequestError } from "@/lib/api";
import { ButtonType, HeaderType, TemplateButton, TemplateCategory, WhatsAppTemplate } from "@/lib/types";

interface FormState {
  name: string;
  category: TemplateCategory;
  language: string;
  headerType: HeaderType;
  headerContent: string;
  body: string;
  footer: string;
  buttons: TemplateButton[];
}

const EMPTY_FORM: FormState = {
  name: "",
  category: "UTILITY",
  language: "en_US",
  headerType: "NONE",
  headerContent: "",
  body: "",
  footer: "",
  buttons: [],
};

function renderPreview(body: string, sampleVars: Record<string, string>): string {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, idx) => sampleVars[idx] ?? `[var ${idx}]`);
}

export default function TemplateBuilderPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<string[]>([]);

  const { data: existing } = useQuery({
    queryKey: ["template", id],
    queryFn: () => api.get<WhatsAppTemplate>(`/templates/${id}`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        category: existing.category,
        language: existing.language,
        headerType: existing.headerType,
        headerContent: existing.headerContent ?? "",
        body: existing.body,
        footer: existing.footer ?? "",
        buttons: existing.buttons ?? [],
      });
    }
  }, [existing]);

  const isLocked = existing?.status === "APPROVED";

  const saveMutation = useMutation({
    mutationFn: () =>
      isEdit
        ? api.put<WhatsAppTemplate>(`/templates/${id}`, payload())
        : api.post<WhatsAppTemplate>("/templates", payload()),
    onSuccess: (tpl) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({ title: isEdit ? "Template updated" : "Template created", variant: "success" });
      navigate(`/templates/${tpl.id}/edit`);
    },
    onError: (err) => {
      if (err instanceof ApiRequestError) {
        setErrors([err.message]);
      }
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => api.post<WhatsAppTemplate>(`/templates/${id}/submit`),
    onSuccess: (tpl) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      queryClient.invalidateQueries({ queryKey: ["template", id] });
      toast({
        title: "Submitted for approval",
        description: `Template is now ${tpl.status.toLowerCase()}.`,
        variant: tpl.status === "REJECTED" ? "destructive" : "success",
      });
    },
  });

  function payload() {
    return {
      name: form.name.trim(),
      category: form.category,
      language: form.language,
      headerType: form.headerType,
      headerContent: form.headerType === "NONE" ? undefined : form.headerContent,
      body: form.body,
      footer: form.footer || undefined,
      buttons: form.buttons.length ? form.buttons : undefined,
    };
  }

  function validate(): boolean {
    const errs: string[] = [];
    if (!/^[a-z0-9_]{3,64}$/.test(form.name)) {
      errs.push("Template name must be snake_case (lowercase letters, numbers, underscores), 3-64 characters.");
    }
    if (!form.body.trim()) errs.push("Body text is required.");
    if (form.headerType !== "NONE" && !form.headerContent.trim()) errs.push("Header content is required for the selected header type.");
    if (form.buttons.length > 3) errs.push("A template can have at most 3 buttons.");
    setErrors(errs);
    return errs.length === 0;
  }

  function updateButton(index: number, patch: Partial<TemplateButton>) {
    setForm((f) => ({ ...f, buttons: f.buttons.map((b, i) => (i === index ? { ...b, ...patch } : b)) }));
  }

  const sampleVars: Record<string, string> = { "1": "Aarav", "2": "Modular Kitchen", "3": "45", "4": "12 Nov" };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={isEdit ? "Edit Template" : "New Template"}
        description="Design a WhatsApp message template for approval."
        actions={
          <Button variant="outline" onClick={() => navigate("/templates")}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        }
      />

      {isLocked && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          This template is approved and locked from editing. Duplicate it to make changes.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Template Details</CardTitle>
              <CardDescription>Name and categorize your template.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label>Template Name</Label>
                <Input
                  placeholder="appointment_confirmation"
                  value={form.name}
                  disabled={isLocked}
                  onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                />
                <p className="text-xs text-muted-foreground">snake_case only, e.g. appointment_confirmation</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as TemplateCategory })} disabled={isLocked}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTILITY">Utility</SelectItem>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                    <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Language</Label>
                <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })} disabled={isLocked}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en_US">English (US)</SelectItem>
                    <SelectItem value="en_IN">English (India)</SelectItem>
                    <SelectItem value="hi_IN">Hindi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Content</CardTitle>
              <CardDescription>Header, body and footer text. Use {"{{1}}"}, {"{{2}}"} for variables.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Header Type</Label>
                <Select value={form.headerType} onValueChange={(v) => setForm({ ...form, headerType: v as HeaderType })} disabled={isLocked}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    <SelectItem value="TEXT">Text</SelectItem>
                    <SelectItem value="IMAGE">Image</SelectItem>
                    <SelectItem value="VIDEO">Video</SelectItem>
                    <SelectItem value="DOCUMENT">Document</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.headerType !== "NONE" && (
                <div className="flex flex-col gap-1.5">
                  <Label>{form.headerType === "TEXT" ? "Header Text" : "Header Media URL"}</Label>
                  <Input
                    value={form.headerContent}
                    disabled={isLocked}
                    onChange={(e) => setForm({ ...form, headerContent: e.target.value })}
                    placeholder={form.headerType === "TEXT" ? "Appointment Confirmed" : "https://..."}
                  />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label>Body</Label>
                <Textarea
                  rows={5}
                  value={form.body}
                  disabled={isLocked}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="Hi {{1}}, your appointment is confirmed for {{2}}."
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Footer (optional)</Label>
                <Input value={form.footer} disabled={isLocked} onChange={(e) => setForm({ ...form, footer: e.target.value })} placeholder="KSS Interiors" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Buttons</CardTitle>
                <CardDescription>Up to 3 quick reply, website or phone buttons.</CardDescription>
              </div>
              {!isLocked && form.buttons.length < 3 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setForm((f) => ({ ...f, buttons: [...f.buttons, { type: "QUICK_REPLY", label: "" }] }))}
                >
                  <Plus className="h-4 w-4" /> Add Button
                </Button>
              )}
            </CardHeader>
            {form.buttons.length > 0 && (
              <CardContent className="flex flex-col gap-3">
                {form.buttons.map((btn, i) => (
                  <div key={i} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center">
                    <Select value={btn.type} onValueChange={(v) => updateButton(i, { type: v as ButtonType })} disabled={isLocked}>
                      <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="QUICK_REPLY">Quick Reply</SelectItem>
                        <SelectItem value="WEBSITE">Website</SelectItem>
                        <SelectItem value="PHONE">Phone</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Label" value={btn.label} disabled={isLocked} onChange={(e) => updateButton(i, { label: e.target.value })} />
                    {btn.type !== "QUICK_REPLY" && (
                      <Input
                        placeholder={btn.type === "WEBSITE" ? "https://..." : "+91..."}
                        value={btn.value ?? ""}
                        disabled={isLocked}
                        onChange={(e) => updateButton(i, { value: e.target.value })}
                      />
                    )}
                    {!isLocked && (
                      <Button variant="ghost" size="icon" onClick={() => setForm((f) => ({ ...f, buttons: f.buttons.filter((_, idx) => idx !== i) }))}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            )}
          </Card>

          {errors.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <ul className="list-inside list-disc">
                {errors.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                if (validate()) saveMutation.mutate();
              }}
              loading={saveMutation.isPending}
              disabled={isLocked}
            >
              {isEdit ? "Save Changes" : "Create Template"}
            </Button>
            {isEdit && (existing?.status === "DRAFT" || existing?.status === "REJECTED") && (
              <Button variant="outline" onClick={() => submitMutation.mutate()} loading={submitMutation.isPending}>
                Submit for Approval
              </Button>
            )}
          </div>
        </div>

        <div className="lg:sticky lg:top-20 lg:h-fit">
          <Card>
            <CardHeader>
              <CardTitle>Live Preview</CardTitle>
              <CardDescription>Approximate rendering on WhatsApp.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl bg-[#e5ded5] p-4">
                <div className="max-w-full rounded-lg bg-white p-3 shadow-sm">
                  {form.headerType === "TEXT" && form.headerContent && <p className="mb-1 text-sm font-semibold">{form.headerContent}</p>}
                  {form.headerType !== "NONE" && form.headerType !== "TEXT" && (
                    <div className="mb-2 flex h-24 items-center justify-center rounded-md bg-secondary text-xs text-muted-foreground">
                      <MessageCircle className="mr-1 h-4 w-4" /> {form.headerType} preview
                    </div>
                  )}
                  <p className="whitespace-pre-wrap text-sm text-neutral-800">{renderPreview(form.body, sampleVars) || "Your message body will appear here."}</p>
                  {form.footer && <p className="mt-2 text-xs text-neutral-500">{form.footer}</p>}
                  {form.buttons.length > 0 && (
                    <div className="mt-3 flex flex-col gap-1 border-t border-neutral-200 pt-2">
                      {form.buttons.map((b, i) => (
                        <div key={i} className="rounded-md py-1.5 text-center text-sm font-medium text-primary">
                          {b.label || "Button"}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
