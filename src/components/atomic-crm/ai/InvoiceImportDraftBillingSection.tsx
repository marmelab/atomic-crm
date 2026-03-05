import { Input } from "@/components/ui/input";
import type { InvoiceImportRecordDraft } from "@/lib/ai/invoiceImport";
import { hasBillingProfileDraft } from "./invoiceImportDraftHelpers";
import { CollapsibleSection, Field } from "./InvoiceImportDraftPrimitives";

export const InvoiceImportDraftBillingSection = ({
  record,
  onChange,
}: {
  record: InvoiceImportRecordDraft;
  onChange: (patch: Partial<InvoiceImportRecordDraft>) => void;
}) => (
  <CollapsibleSection
    title="Anagrafica fiscale"
    defaultOpen={hasBillingProfileDraft(record)}
  >
    <Field label="Denominazione fiscale">
      <Input
        value={record.billingName ?? ""}
        onChange={(event) => onChange({ billingName: event.target.value })}
      />
    </Field>

    <Field label="Partita IVA">
      <Input
        value={record.vatNumber ?? ""}
        onChange={(event) => onChange({ vatNumber: event.target.value })}
      />
    </Field>

    <Field label="Codice fiscale">
      <Input
        value={record.fiscalCode ?? ""}
        onChange={(event) => onChange({ fiscalCode: event.target.value })}
      />
    </Field>

    <Field label="Via / Piazza">
      <Input
        value={record.billingAddressStreet ?? ""}
        onChange={(event) =>
          onChange({ billingAddressStreet: event.target.value })
        }
      />
    </Field>

    <Field label="N. civico">
      <Input
        value={record.billingAddressNumber ?? ""}
        onChange={(event) =>
          onChange({ billingAddressNumber: event.target.value })
        }
      />
    </Field>

    <Field label="CAP">
      <Input
        value={record.billingPostalCode ?? ""}
        onChange={(event) =>
          onChange({ billingPostalCode: event.target.value })
        }
      />
    </Field>

    <Field label="Comune">
      <Input
        value={record.billingCity ?? ""}
        onChange={(event) => onChange({ billingCity: event.target.value })}
      />
    </Field>

    <Field label="Provincia">
      <Input
        value={record.billingProvince ?? ""}
        onChange={(event) => onChange({ billingProvince: event.target.value })}
      />
    </Field>

    <Field label="Nazione">
      <Input
        value={record.billingCountry ?? ""}
        onChange={(event) => onChange({ billingCountry: event.target.value })}
      />
    </Field>

    <Field label="Codice destinatario">
      <Input
        value={record.billingSdiCode ?? ""}
        onChange={(event) => onChange({ billingSdiCode: event.target.value })}
      />
    </Field>

    <Field label="PEC">
      <Input
        value={record.billingPec ?? ""}
        onChange={(event) => onChange({ billingPec: event.target.value })}
      />
    </Field>
  </CollapsibleSection>
);
