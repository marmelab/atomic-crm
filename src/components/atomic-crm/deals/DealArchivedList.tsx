/* eslint-disable react-refresh/only-export-components */
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useGetIdentity, useGetList } from "ra-core";
import { useEffect, useState } from "react";
import type { Deal } from "../types";
import { DealCardContent } from "./DealCard";

export const DealArchivedList = () => {
  const { identity } = useGetIdentity();
  const {
    data: archivedLists,
    total,
    isPending,
  } = useGetList("deals", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "archived_at", order: "DESC" },
    filter: { "archived_at@not.is": null },
  });
  const [openDialog, setOpenDialog] = useState(false);

  useEffect(() => {
    if (!isPending && total === 0) {
      setOpenDialog(false);
    }
  }, [isPending, total]);

  useEffect(() => {
    setOpenDialog(false);
  }, [archivedLists]);

  if (!identity || isPending || !total || !archivedLists) return null;

  // Group archived lists by date
  const archivedListsByDate: { [date: string]: Deal[] } = archivedLists.reduce(
    (acc, deal) => {
      const date = new Date(deal.archived_at).toDateString();
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(deal);
      return acc;
    },
    {} as { [date: string]: Deal[] },
  );

  return (
    <div className="w-full flex flex-row items-center justify-center">
      <Button
        variant="ghost"
        onClick={() => setOpenDialog(true)}
        className="my-4"
      >
        View archived deals
      </Button>
      <Dialog open={openDialog} onOpenChange={() => setOpenDialog(false)}>
        <DialogContent className="lg:max-w-4xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
          <DialogTitle>Archived Deals</DialogTitle>
          <div className="flex flex-col gap-8">
            {Object.entries(archivedListsByDate).map(([date, deals]) => (
              <div key={date} className="flex flex-col gap-4">
                <h4 className="font-bold">{getRelativeTimeString(date)}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
                  {deals.map((deal: Deal) => (
                    <div key={deal.id}>
                      <DealCardContent deal={deal} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export function getRelativeTimeString(dateString: string): string {
  const date = new Date(dateString);
  date.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diff = date.getTime() - today.getTime();
  const unitDiff = Math.round(diff / (1000 * 60 * 60 * 24));

  // Check if the date is more than one week old
  if (Math.abs(unitDiff) > 7) {
    return new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "long",
    }).format(date);
  }

  // Intl.RelativeTimeFormat for dates within the last week
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  return ucFirst(rtf.format(unitDiff, "day"));
}

function ucFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
