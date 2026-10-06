import { Badge } from "@/components/ui/badge";

const STATUS_VARIANTS: Record<string, "success" | "warning" | "destructive" | "secondary" | "accent" | "outline"> = {
  APPROVED: "success",
  CONNECTED: "success",
  SENT: "accent",
  DELIVERED: "success",
  READ: "success",
  COMPLETED: "success",
  PENDING: "warning",
  QUEUED: "warning",
  SCHEDULED: "warning",
  PROCESSING: "warning",
  PARTIALLY_COMPLETED: "warning",
  DRAFT: "secondary",
  NOT_CONNECTED: "secondary",
  DISABLED: "secondary",
  SKIPPED: "secondary",
  REJECTED: "destructive",
  FAILED: "destructive",
  ERROR: "destructive",
  CANCELLED: "destructive",
};

function formatLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANTS[status] ?? "outline"}>{formatLabel(status)}</Badge>;
}
