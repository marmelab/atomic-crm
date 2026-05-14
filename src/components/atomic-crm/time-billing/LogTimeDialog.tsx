import { useState } from "react";
import { Clock } from "lucide-react";
import {
  useDataProvider,
  useGetIdentity,
  useGetList,
  useGetOne,
  useNotify,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import type { Company, Sale, TimeEntry } from "../types";
import { ALL_SERVICE_LINES, SERVICE_LINE_LABELS } from "./serviceLines";

const todayISO = () => new Date().toISOString().split("T")[0];

export const LogTimeDialog = () => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const { identity } = useGetIdentity();

  // Fetch current user's default rate
  const { data: currentSale } = useGetOne<Sale>(
    "sales",
    { id: identity?.id ?? 0 },
    { enabled: !!identity?.id },
  );

  const { data: companies = [] } = useGetList<Company>("companies", {
    pagination: { page: 1, perPage: 10000 },
    sort: { field: "name", order: "ASC" },
  });

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [companyId, setCompanyId] = useState("");
  const [entryDate, setEntryDate] = useState(todayISO());
  const [hours, setHours] = useState("1.00");
  const [billable, setBillable] = useState(true);
  const [rate, setRate] = useState("");
  const [serviceLine, setServiceLine] = useState("");
  const [description, setDescription] = useState("");

  const handleOpen = () => {
    // Pre-fill rate from user default when dialog opens
    setRate(
      currentSale?.default_hourly_rate_szl != null
        ? String(currentSale.default_hourly_rate_szl)
        : "",
    );
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setCompanyId("");
    setEntryDate(todayISO());
    setHours("1.00");
    setBillable(true);
    setServiceLine("");
    setDescription("");
  };

  const isValid =
    companyId !== "" &&
    entryDate !== "" &&
    Number(hours) > 0 &&
    (!billable || Number(rate) >= 0) &&
    serviceLine !== "" &&
    description.trim() !== "";

  const handleSave = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      const entry: Omit<TimeEntry, "id" | "created_at"> = {
        company_id: Number(companyId),
        contact_id: null,
        entry_date: entryDate,
        hours: Number(hours),
        billable,
        hourly_rate_szl: Number(rate) || 0,
        service_line: serviceLine as TimeEntry["service_line"],
        description: description.trim(),
        linked_filing_id: null,
        invoice_id: null,
      };
      await dataProvider.create("time_entries", { data: entry });
      notify("crm.time_billing.entry_saved", { type: "success" });
      handleClose();
      refresh();
    } catch {
      notify("crm.time_billing.entry_save_error", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button onClick={handleOpen} size="sm" className="h-9">
        <Clock className="h-4 w-4 mr-2" />
        Log Time
      </Button>

      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Log Time Entry</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Company */}
            <div className="flex flex-col gap-1.5">
              <Label>Company *</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select company..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date + Hours row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Hours *</Label>
                <Input
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="1.00"
                />
              </div>
            </div>

            {/* Billable toggle + Rate */}
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="flex items-center gap-2 pt-4">
                <Switch
                  id="billable"
                  checked={billable}
                  onCheckedChange={setBillable}
                />
                <Label htmlFor="billable">Billable</Label>
              </div>
              {billable && (
                <div className="flex flex-col gap-1.5">
                  <Label>Rate (E/hour) *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="50"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>

            {/* Service line */}
            <div className="flex flex-col gap-1.5">
              <Label>Service Line *</Label>
              <Select value={serviceLine} onValueChange={setServiceLine}>
                <SelectTrigger>
                  <SelectValue placeholder="Select service..." />
                </SelectTrigger>
                <SelectContent>
                  {ALL_SERVICE_LINES.map((sl) => (
                    <SelectItem key={sl} value={sl}>
                      {SERVICE_LINE_LABELS[sl]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <Label>Description *</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of work done..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading || !isValid}>
              {loading ? "Saving..." : "Save Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
