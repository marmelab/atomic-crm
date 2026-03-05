import { memo } from "react";
import { TextInput } from "@/components/admin/text-input";
import { StickyNote } from "lucide-react";

export const QuoteNotesInputs = memo(() => (
  <div className="flex flex-col gap-4">
    <div className="flex items-center gap-2 mb-1">
      <StickyNote className="h-4 w-4 text-slate-500" />
      <h6 className="text-sm font-semibold text-slate-700">Note</h6>
    </div>

    <TextInput
      source="description"
      label="Descrizione breve"
      multiline
      rows={3}
      helperText="Titolo o riepilogo breve del preventivo."
    />

    <TextInput
      source="notes"
      label="Note"
      multiline
      rows={2}
      helperText={false}
    />
  </div>
));
