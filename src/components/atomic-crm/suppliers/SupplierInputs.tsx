import { required } from "ra-core";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { CloudinaryUploadInput } from "../cloudinary/CloudinaryUploadInput";

const supplierExpenseTypeChoices = [
  { id: "spostamento_km", name: "Spostamento Km" },
  { id: "pedaggio_autostradale", name: "Pedaggio autostradale" },
  { id: "vitto_alloggio", name: "Vitto e alloggio" },
  { id: "acquisto_materiale", name: "Acquisto materiale" },
  { id: "abbonamento_software", name: "Abbonamento software" },
  { id: "noleggio", name: "Noleggio" },
  { id: "altro", name: "Altro" },
];

export const SupplierInputs = () => (
  <div className="flex flex-col gap-6 p-1">
    <CloudinaryUploadInput
      source="logo_url"
      label="Logo fornitore"
      folder="crm/suppliers"
      mode="avatar"
    />

    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Anagrafica</h3>
        <TextInput
          source="name"
          label="Nome / Ragione sociale"
          validate={required()}
          helperText={false}
        />
        <TextInput source="vat_number" label="Partita IVA" helperText={false} />
        <TextInput
          source="fiscal_code"
          label="Codice Fiscale"
          helperText={false}
        />
        <TextInput source="phone" label="Telefono" helperText={false} />
        <TextInput source="email" label="Email" helperText={false} />
        <TextInput source="address" label="Indirizzo" helperText={false} />
        <SelectInput
          source="default_expense_type"
          label="Tipo spesa predefinito"
          choices={supplierExpenseTypeChoices}
          helperText="Pre-compila il tipo spesa quando crei una spesa da questo fornitore"
          emptyText="Nessuno"
        />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Fatturazione</h3>
        <TextInput
          source="billing_address_street"
          label="Via"
          helperText={false}
        />
        <TextInput
          source="billing_address_number"
          label="Civico"
          helperText={false}
        />
        <div className="grid grid-cols-2 gap-4">
          <TextInput
            source="billing_postal_code"
            label="CAP"
            helperText={false}
          />
          <TextInput source="billing_city" label="Città" helperText={false} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <TextInput
            source="billing_province"
            label="Provincia"
            helperText={false}
          />
          <TextInput
            source="billing_country"
            label="Paese"
            helperText={false}
          />
        </div>
        <TextInput
          source="billing_sdi_code"
          label="Codice SDI"
          helperText={false}
        />
        <TextInput source="billing_pec" label="PEC" helperText={false} />
      </div>
    </div>
  </div>
);
