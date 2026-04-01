import { TextInput } from "@/components/admin/text-input";

export const BusinessProfileSettingsSection = () => (
  <div className="space-y-4">
    <p className="text-sm text-muted-foreground">
      Dati dell'emittente usati nei PDF di preventivi e bozze fattura.
    </p>
    <TextInput source="businessProfile.name" label="Nome" />
    <TextInput
      source="businessProfile.beneficiaryName"
      label="Beneficiario pagamento (nome completo)"
    />
    <TextInput source="businessProfile.tagline" label="Sottotitolo" />
    <TextInput source="businessProfile.vatNumber" label="P.IVA" />
    <TextInput source="businessProfile.fiscalCode" label="Codice Fiscale" />
    <TextInput source="businessProfile.sdiCode" label="Codice Univoco (SDI)" />
    <TextInput source="businessProfile.iban" label="IBAN" />
    <TextInput source="businessProfile.bankName" label="Banca" />
    <TextInput source="businessProfile.bic" label="BIC / SWIFT" />
    <TextInput source="businessProfile.address" label="Indirizzo (display)" />

    <p className="text-xs font-medium text-muted-foreground pt-2">
      Indirizzo strutturato — usato nella generazione XML FatturaPA
    </p>
    <div className="grid grid-cols-2 gap-3">
      <TextInput source="businessProfile.addressStreet" label="Via/Piazza" />
      <TextInput source="businessProfile.addressNumber" label="Civico" />
      <TextInput source="businessProfile.addressPostalCode" label="CAP" />
      <TextInput source="businessProfile.addressCity" label="Comune" />
      <TextInput source="businessProfile.addressProvince" label="Provincia" />
      <TextInput source="businessProfile.addressCountry" label="Nazione" />
    </div>

    <TextInput source="businessProfile.email" label="Email" />
    <TextInput source="businessProfile.phone" label="Telefono" />
  </div>
);
