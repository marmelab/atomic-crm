import type { InvoiceImportRecordDraft } from "@/lib/ai/invoiceImport";
import {
  paymentMethodChoices,
  paymentStatusChoices,
  paymentTypeChoices,
} from "../payments/paymentTypes";
import { Field, Section, SelectField } from "./InvoiceImportDraftPrimitives";

export const InvoiceImportDraftPaymentSection = ({
  record,
  onChange,
}: {
  record: InvoiceImportRecordDraft;
  onChange: (patch: Partial<InvoiceImportRecordDraft>) => void;
}) => (
  <Section title="Dettagli pagamento" color="blue">
    <Field label="Tipo">
      <SelectField
        value={record.paymentType ?? "saldo"}
        onChange={(value) =>
          onChange({
            paymentType: value as InvoiceImportRecordDraft["paymentType"],
          })
        }
      >
        {paymentTypeChoices.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.name}
          </option>
        ))}
      </SelectField>
    </Field>

    <Field label="Metodo">
      <SelectField
        value={record.paymentMethod ?? "bonifico"}
        onChange={(value) =>
          onChange({
            paymentMethod: value as InvoiceImportRecordDraft["paymentMethod"],
          })
        }
      >
        {paymentMethodChoices.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.name}
          </option>
        ))}
      </SelectField>
    </Field>

    <Field label="Stato">
      <SelectField
        value={record.paymentStatus ?? "in_attesa"}
        onChange={(value) =>
          onChange({
            paymentStatus: value as InvoiceImportRecordDraft["paymentStatus"],
          })
        }
      >
        {paymentStatusChoices.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.name}
          </option>
        ))}
      </SelectField>
    </Field>
  </Section>
);
