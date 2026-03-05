import { Input } from "@/components/ui/input";
import type { InvoiceImportRecordDraft } from "@/lib/ai/invoiceImport";
import {
  expenseTypeChoices,
  expenseTypeLabels,
} from "../expenses/expenseTypes";
import { Field, Section, SelectField } from "./InvoiceImportDraftPrimitives";

export const InvoiceImportDraftExpenseSection = ({
  record,
  onChange,
}: {
  record: InvoiceImportRecordDraft;
  onChange: (patch: Partial<InvoiceImportRecordDraft>) => void;
}) => (
  <Section title="Dettagli spesa">
    <Field label="Tipo spesa">
      <SelectField
        value={record.expenseType ?? "acquisto_materiale"}
        onChange={(value) =>
          onChange({
            expenseType: value as InvoiceImportRecordDraft["expenseType"],
          })
        }
      >
        {expenseTypeChoices.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.name}
          </option>
        ))}
      </SelectField>
    </Field>

    <Field label="Descrizione" className="md:col-span-2">
      <Input
        value={
          record.description ??
          expenseTypeLabels[record.expenseType ?? "acquisto_materiale"] ??
          ""
        }
        onChange={(event) => onChange({ description: event.target.value })}
      />
    </Field>
  </Section>
);
