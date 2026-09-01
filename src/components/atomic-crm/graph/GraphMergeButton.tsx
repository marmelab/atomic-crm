import { useState } from "react";
import { useDataProvider, useGetList, useNotify, useRedirect } from "ra-core";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CrmDataProvider } from "../providers/types";

interface GraphMergeButtonProps {
  loserId: string;
  firstName: string;
  lastName: string;
}

interface MergeCandidate {
  id: string;
  first_name: string;
  last_name: string;
  primary_type?: string | null;
}

export function GraphMergeButton({
  loserId,
  firstName,
  lastName,
}: GraphMergeButtonProps) {
  const [winnerId, setWinnerId] = useState("");
  const [busy, setBusy] = useState(false);
  const notify = useNotify();
  const redirect = useRedirect();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { data } = useGetList<MergeCandidate>("contacts", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "last_name", order: "ASC" },
  });
  const candidates = (data ?? []).filter((row) => row.id !== loserId);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-sm">
        Merge into
        <Select value={winnerId} onValueChange={setWinnerId}>
          <SelectTrigger className="mt-1 w-80" aria-label="Merge into">
            <SelectValue placeholder="Choose the contact to keep" />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((row) => (
              <SelectItem key={row.id} value={row.id}>
                {row.first_name} {row.last_name}
                {row.primary_type ? ` · ${row.primary_type}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <Button
        variant="outline"
        disabled={busy || !winnerId}
        onClick={async () => {
          try {
            setBusy(true);
            if (!dataProvider.mergeContacts) {
              throw new Error("merge is not wired");
            }
            await dataProvider.mergeContacts(loserId, winnerId);
            notify("Contacts merged", { type: "success" });
            redirect("show", "contacts", winnerId);
          } catch {
            notify("Merge failed", { type: "error" });
          } finally {
            setBusy(false);
          }
        }}
      >
        Merge {firstName} {lastName}
      </Button>
    </div>
  );
}
