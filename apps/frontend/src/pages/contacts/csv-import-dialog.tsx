import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileDown, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";

type Step = "upload" | "map" | "preview" | "result";

interface ImportResult {
  total: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  invalidRecords: { row: Record<string, string>; reason: string }[];
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => line.split(",").map((cell) => cell.trim()));
  return { headers, rows };
}

export function CsvImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<{ name?: string; phone?: string; email?: string }>({});
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setResult(null);
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const { headers: h, rows: r } = parseCsv(String(reader.result));
      setHeaders(h);
      setRows(r);
      setMapping({
        name: h.find((c) => /name/i.test(c)),
        phone: h.find((c) => /phone|mobile|number/i.test(c)),
        email: h.find((c) => /email/i.test(c)),
      });
      setStep("map");
    };
    reader.readAsText(file);
  }

  const mappedRows = rows.map((r) => {
    const record: Record<string, string> = {};
    headers.forEach((h, i) => (record[h] = r[i] ?? ""));
    return {
      name: mapping.name ? record[mapping.name] : "",
      phone: mapping.phone ? record[mapping.phone] : "",
      email: mapping.email ? record[mapping.email] : "",
    };
  });

  const importMutation = useMutation({
    mutationFn: () => api.post<ImportResult>("/contacts/import", { rows: mappedRows }),
    onSuccess: (res) => {
      setResult(res);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({ title: "Import complete", description: `${res.validCount} contacts imported.`, variant: "success" });
    },
  });

  function downloadInvalidReport() {
    if (!result) return;
    const csvLines = ["name,phone,email,reason", ...result.invalidRecords.map((r) => `${r.row.name ?? ""},${r.row.phone ?? ""},${r.row.email ?? ""},${r.reason}`)];
    const blob = new Blob([csvLines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invalid_records.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Contacts from CSV</DialogTitle>
          <DialogDescription>Upload a CSV file, map the columns, and review before importing.</DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-10 text-center hover:bg-secondary/40">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Click to select a CSV file</p>
            <p className="text-xs text-muted-foreground">Expected columns: name, phone, email (any order)</p>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </label>
        )}

        {step === "map" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">Found {rows.length} rows. Map your CSV columns to contact fields.</p>
            {(["name", "phone", "email"] as const).map((field) => (
              <div key={field} className="flex items-center justify-between gap-3">
                <span className="w-24 text-sm font-medium capitalize">{field}</span>
                <Select value={mapping[field] ?? "__none"} onValueChange={(v) => setMapping((m) => ({ ...m, [field]: v === "__none" ? undefined : v }))}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select column" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Not mapped</SelectItem>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
              <Button disabled={!mapping.name || !mapping.phone} onClick={() => setStep("preview")}>Continue</Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">Preview of the first 5 mapped rows out of {mappedRows.length}.</p>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {mappedRows.slice(0, 5).map((r, i) => (
                  <TableRow key={i}><TableCell>{r.name}</TableCell><TableCell>{r.phone}</TableCell><TableCell>{r.email}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("map")}>Back</Button>
              <Button loading={importMutation.isPending} onClick={() => importMutation.mutate()}>
                Import {mappedRows.length} Contacts
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "result" && result && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5" />
              <p className="text-sm font-medium">Import finished</p>
            </div>
            <div className="grid grid-cols-4 gap-3 text-center">
              <ResultStat label="Total" value={result.total} />
              <ResultStat label="Valid" value={result.validCount} />
              <ResultStat label="Invalid" value={result.invalidCount} />
              <ResultStat label="Duplicates" value={result.duplicateCount} />
            </div>
            {result.invalidRecords.length > 0 && (
              <Button variant="outline" onClick={downloadInvalidReport}>
                <FileDown className="h-4 w-4" /> Download Invalid Records Report
              </Button>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button>Done</Button>
              </DialogClose>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResultStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
