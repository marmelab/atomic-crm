import { memo } from "react";
import { required, minValue } from "ra-core";
import { useWatch } from "react-hook-form";
import { ArrayInput } from "@/components/admin/array-input";
import { TextInput } from "@/components/admin/text-input";
import { NumberInput } from "@/components/admin/number-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { ListChecks } from "lucide-react";

import type { QuoteItem } from "../../types";
import { hasQuoteItems } from "../quoteItems";

export const QuoteItemsInputs = memo(() => {
  const quoteItems = useWatch({ name: "quote_items" }) as
    | QuoteItem[]
    | undefined;
  const itemizedQuote = hasQuoteItems(quoteItems);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-1">
        <ListChecks className="h-4 w-4 text-emerald-500" />
        <h6 className="text-sm font-semibold text-emerald-700">Voci e importo</h6>
      </div>

      <ArrayInput
        source="quote_items"
        label="Voci preventivo"
        helperText="Opzionale. Se aggiungi voci, l'importo totale si calcola da solo."
      >
        <SimpleFormIterator
          disableReordering
          getItemLabel={(index) => `Voce ${index + 1}`}
        >
          <TextInput
            source="description"
            label="Voce"
            validate={required()}
            helperText={false}
          />
          <NumberInput
            source="quantity"
            label="Quantità"
            defaultValue={1}
            validate={[required(), minValue(1)]}
            helperText={false}
          />
          <NumberInput
            source="unit_price"
            label="Prezzo unitario (EUR)"
            defaultValue={0}
            validate={[required(), minValue(0)]}
            helperText={false}
          />
        </SimpleFormIterator>
      </ArrayInput>

      <NumberInput
        source="amount"
        label="Importo preventivo (EUR)"
        validate={[required(), minValue(0)]}
        defaultValue={0}
        disabled={itemizedQuote}
        helperText={
          itemizedQuote
            ? "Calcolato automaticamente dalle voci del preventivo."
            : false
        }
      />
    </div>
  );
});
