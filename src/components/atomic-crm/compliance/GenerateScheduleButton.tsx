import { useState } from "react";
import { CalendarCheck } from "lucide-react";
import {
  useDataProvider,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Company } from "../types";
import {
  currentEswatiniFyStartYear,
  generateFilingsForCompany,
} from "./generateFilings";

export const GenerateScheduleButton = () => {
  const company = useRecordContext<Company>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();

  const currentFy = currentEswatiniFyStartYear();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(String(currentFy));

  // Allow selecting 2 years back and 2 years forward
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentFy - 2 + i);

  if (!company) return null;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const drafts = generateFilingsForCompany(
        company,
        Number(selectedYear),
        null,
      );
      await Promise.all(
        drafts.map((draft) =>
          dataProvider.create("compliance_filings", { data: draft }),
        ),
      );
      notify("crm.compliance.generated_success", {
        type: "success",
        messageArgs: { count: drafts.length },
      });
      setOpen(false);
      refresh();
    } catch {
      notify("crm.compliance.generated_error", { type: "error" });
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
        <CalendarCheck className="h-4 w-4 mr-2" />
        Generate Filing Schedule
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Compliance Schedule</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              This will generate all required filings for{" "}
              <strong>{company.name}</strong> for the selected Eswatini tax year
              (1 Jul – 30 Jun).
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Tax Year</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      FY {y}/{y + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={loading}>
              {loading ? "Generating..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
