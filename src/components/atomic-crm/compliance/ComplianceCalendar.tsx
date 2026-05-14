import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ComplianceFiling } from "../types";
import { FILING_TYPE_LABELS, FILING_STATUS_COLORS } from "./filingTypes";

interface ComplianceCalendarProps {
  filings: ComplianceFiling[];
  companies: Record<number, string>;
}

export const ComplianceCalendar = ({
  filings,
  companies,
}: ComplianceCalendarProps) => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  // Days in month grid
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Index filings by day of month for this year/month
  const filingsByDay: Record<number, ComplianceFiling[]> = {};
  for (const filing of filings) {
    const d = new Date(filing.due_date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!filingsByDay[day]) filingsByDay[day] = [];
      filingsByDay[day].push(filing);
    }
  }

  const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Build calendar cells: leading blanks + day cells
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (day: number) =>
    day === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear();

  return (
    <div className="flex flex-col gap-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={prevMonth}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h3 className="text-lg font-semibold">
          {MONTH_NAMES[month]} {year}
        </h3>
        <Button variant="outline" size="icon" onClick={nextMonth}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-t-md overflow-hidden">
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="bg-muted text-center text-xs font-medium py-2 text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-b-md overflow-hidden">
        {cells.map((day, idx) => {
          if (day === null) {
            return (
              <div key={`blank-${idx}`} className="bg-background min-h-20" />
            );
          }
          const dayFilings = filingsByDay[day] ?? [];
          return (
            <div
              key={day}
              className={cn(
                "bg-background min-h-20 p-1 flex flex-col gap-0.5",
                isToday(day) && "ring-2 ring-inset ring-primary",
              )}
            >
              <span
                className={cn(
                  "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                  isToday(day) && "bg-primary text-primary-foreground",
                )}
              >
                {day}
              </span>
              {dayFilings.slice(0, 3).map((f) => (
                <div
                  key={f.id}
                  className={cn(
                    "text-xs rounded px-1 truncate cursor-default",
                    FILING_STATUS_COLORS[f.status],
                  )}
                  title={`${FILING_TYPE_LABELS[f.filing_type]} — ${companies[Number(f.company_id)] ?? "Unknown"}`}
                >
                  {FILING_TYPE_LABELS[f.filing_type]}
                </div>
              ))}
              {dayFilings.length > 3 && (
                <span className="text-xs text-muted-foreground pl-1">
                  +{dayFilings.length - 3} more
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
        {(
          [
            ["UPCOMING", "bg-blue-100 text-blue-800"],
            ["IN_PROGRESS", "bg-amber-100 text-amber-800"],
            ["SUBMITTED", "bg-green-100 text-green-800"],
            ["OVERDUE", "bg-red-100 text-red-800"],
          ] as const
        ).map(([label, cls]) => (
          <span key={label} className={cn("px-2 py-0.5 rounded-full", cls)}>
            {label.replace("_", " ")}
          </span>
        ))}
      </div>
    </div>
  );
};
