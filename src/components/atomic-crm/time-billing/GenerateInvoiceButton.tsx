// src/components/atomic-crm/time-billing/GenerateInvoiceButton.tsx
import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import {
  useDataProvider,
  useGetList,
  useNotify,
  useRecordContext,
  useRefresh,
} from "ra-core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import type { Company, Invoice, TimeEntry } from "../types";
import { formatSZL } from "@/lib/format";

const VAT_RATE = 0.15;

/** Generate INV-YYYY-NNNN where NNNN is the next sequence number for the year */
const nextInvoiceNumber = (existing: Invoice[], year: number): string => {
  const thisYear = existing.filter((inv) =>
    inv.invoice_number.startsWith(`INV-${year}-`),
  );
  const seq = thisYear.length + 1;
  return `INV-${year}-${String(seq).padStart(4, "0")}`;
};

export const GenerateInvoiceButton = () => {
  const company = useRecordContext<Company>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [applyVat, setApplyVat] = useState(true);
  const [notes, setNotes] = useState("");

  const { data: allInvoices = [] } = useGetList<Invoice>("invoices", {
    pagination: { page: 1, perPage: 10000 },
    sort: { field: "created_at", order: "DESC" },
  });

  // Unbilled billable entries for this company in the selected date range
  const { data: allEntries = [] } = useGetList<TimeEntry>(
    "time_entries",
    {
      filter: { company_id: company?.id },
      pagination: { page: 1, perPage: 10000 },
      sort: { field: "entry_date", order: "ASC" },
    },
    { enabled: !!company?.id && open },
  );

  const eligibleEntries = useMemo(() => {
    if (!periodStart || !periodEnd) return [];
    return allEntries.filter(
      (e) =>
        e.billable &&
        e.invoice_id == null &&
        e.entry_date >= periodStart &&
        e.entry_date <= periodEnd,
    );
  }, [allEntries, periodStart, periodEnd]);

  const subtotal = useMemo(
    () =>
      eligibleEntries.reduce(
        (s, e) => s + e.hours * (e.hourly_rate_szl ?? 0),
        0,
      ),
    [eligibleEntries],
  );
  const vatAmount = applyVat ? subtotal * VAT_RATE : 0;
  const total = subtotal + vatAmount;

  if (!company) return null;

  const handleGenerate = async () => {
    if (eligibleEntries.length === 0) {
      notify("crm.time_billing.no_entries_in_range", { type: "warning" });
      return;
    }
    setLoading(true);
    try {
      const invNum = nextInvoiceNumber(allInvoices, new Date().getFullYear());
      const { data: invoice } = await dataProvider.create<Invoice>("invoices", {
        data: {
          invoice_number: invNum,
          company_id: company.id,
          period_start: periodStart,
          period_end: periodEnd,
          subtotal_szl: Math.round(subtotal * 100) / 100,
          vat_szl: Math.round(vatAmount * 100) / 100,
          total_szl: Math.round(total * 100) / 100,
          status: "DRAFT",
          notes: notes.trim() || null,
        } as Omit<Invoice, "id" | "created_at" | "updated_at">,
      });

      // Link all eligible entries to this invoice
      await Promise.all(
        eligibleEntries.map((e) =>
          dataProvider.update<TimeEntry>("time_entries", {
            id: e.id,
            data: { invoice_id: invoice.id },
            previousData: e,
          }),
        ),
      );

      notify("crm.time_billing.invoice_created", {
        type: "success",
        messageArgs: { number: invNum },
      });
      setOpen(false);
      setPeriodStart("");
      setPeriodEnd("");
      setNotes("");
      refresh();
    } catch {
      notify("crm.time_billing.invoice_create_error", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-9"
        onClick={() => setOpen(true)}
      >
        <FileText className="h-4 w-4 mr-2" />
        Generate Invoice
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Draft Invoice — {company.name}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Period Start *</Label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Period End *</Label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="apply-vat"
                checked={applyVat}
                onCheckedChange={setApplyVat}
              />
              <Label htmlFor="apply-vat">Apply 15% VAT</Label>
              <span className="text-xs text-muted-foreground ml-1">
                (only if practice is VAT-registered)
              </span>
            </div>

            {/* Preview */}
            {periodStart && periodEnd && (
              <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">
                    Eligible entries:
                  </span>{" "}
                  <strong>{eligibleEntries.length}</strong>
                </p>
                <p>
                  <span className="text-muted-foreground">Subtotal:</span>{" "}
                  <strong>{formatSZL(subtotal)}</strong>
                </p>
                {applyVat && (
                  <p>
                    <span className="text-muted-foreground">VAT (15%):</span>{" "}
                    <strong>{formatSZL(vatAmount)}</strong>
                  </p>
                )}
                <p className="font-semibold">
                  <span className="text-muted-foreground">Total:</span>{" "}
                  {formatSZL(total)}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label>Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. professional services for April 2026"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={loading || !periodStart || !periodEnd}
            >
              {loading ? "Generating..." : "Generate DRAFT Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
