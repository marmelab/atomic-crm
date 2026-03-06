import { Input } from "@/components/ui/input";
import type { InvoiceImportRecordDraft } from "@/lib/ai/invoiceImport";
import type { LabeledValue } from "../root/ConfigurationContext";
import { TravelRouteCalculatorDialog } from "../travel/TravelRouteCalculatorDialog";
import { Field, Section, SelectField } from "./InvoiceImportDraftPrimitives";

export const InvoiceImportDraftServiceSection = ({
  record,
  serviceTypeChoices,
  defaultKmRate,
  onChange,
}: {
  record: InvoiceImportRecordDraft;
  serviceTypeChoices: LabeledValue[];
  defaultKmRate: number;
  onChange: (patch: Partial<InvoiceImportRecordDraft>) => void;
}) => (
  <>
    <Section title="Servizio" color="blue">
      <Field label="Descrizione" className="md:col-span-2">
        <Input
          value={record.description ?? ""}
          onChange={(event) => onChange({ description: event.target.value })}
          className="text-base font-semibold"
        />
      </Field>

      <Field label="Tipo servizio">
        <SelectField
          value={record.serviceType ?? "altro"}
          onChange={(value) =>
            onChange({
              serviceType: value as InvoiceImportRecordDraft["serviceType"],
            })
          }
        >
          {serviceTypeChoices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </SelectField>
      </Field>

      <Field label="Tassabile">
        <SelectField
          value={
            record.isTaxable == null || record.isTaxable ? "true" : "false"
          }
          onChange={(value) => onChange({ isTaxable: value === "true" })}
        >
          <option value="true">Si</option>
          <option value="false">No</option>
        </SelectField>
      </Field>

      <Field label="Data fine">
        <Input
          type="date"
          value={record.serviceEnd ?? ""}
          onChange={(event) =>
            onChange({ serviceEnd: event.target.value || null })
          }
        />
      </Field>

      <Field label="Giornata intera">
        <SelectField
          value={record.allDay == null || record.allDay ? "true" : "false"}
          onChange={(value) => onChange({ allDay: value === "true" })}
        >
          <option value="true">Si</option>
          <option value="false">No</option>
        </SelectField>
      </Field>
    </Section>

    <Section title="Compensi" color="emerald">
      <Field label="Fee riprese">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={record.feeShooting ?? ""}
          onChange={(event) =>
            onChange({
              feeShooting:
                event.target.value === "" ? null : Number(event.target.value),
            })
          }
        />
      </Field>

      <Field label="Fee montaggio">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={record.feeEditing ?? ""}
          onChange={(event) =>
            onChange({
              feeEditing:
                event.target.value === "" ? null : Number(event.target.value),
            })
          }
        />
      </Field>

      <Field label="Fee altro">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={record.feeOther ?? ""}
          onChange={(event) =>
            onChange({
              feeOther:
                event.target.value === "" ? null : Number(event.target.value),
            })
          }
        />
      </Field>

      <Field label="Sconto">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={record.discount ?? ""}
          onChange={(event) =>
            onChange({
              discount:
                event.target.value === "" ? null : Number(event.target.value),
            })
          }
        />
      </Field>
    </Section>

    <Section title="Trasferta" color="amber">
      <Field label="Localita'" className="md:col-span-2">
        <Input
          value={record.location ?? ""}
          onChange={(event) => onChange({ location: event.target.value })}
        />
      </Field>

      <Field label="Km trasferta">
        <Input
          type="number"
          min="0"
          step="0.1"
          value={record.kmDistance ?? ""}
          onChange={(event) =>
            onChange({
              kmDistance:
                event.target.value === "" ? null : Number(event.target.value),
            })
          }
        />
      </Field>

      <Field label="Tariffa km">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={record.kmRate ?? defaultKmRate}
          onChange={(event) =>
            onChange({
              kmRate:
                event.target.value === ""
                  ? null
                  : Number(event.target.value),
            })
          }
        />
      </Field>

      <div className="md:col-span-2">
        <TravelRouteCalculatorDialog
          defaultKmRate={defaultKmRate}
          currentKmRate={record.kmRate}
          initialDestination={record.location ?? undefined}
          onApply={(estimate) =>
            onChange({
              kmDistance: estimate.totalDistanceKm,
              kmRate: estimate.kmRate ?? undefined,
              location: estimate.generatedLocation || undefined,
            })
          }
        />
      </div>
    </Section>
  </>
);
