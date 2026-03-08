import { TextInput } from "@/components/admin/text-input";

export const BusinessProfileSettingsSection = () => (
  <div className="space-y-4">
    <p className="text-sm text-muted-foreground">
      Dati dell'emittente usati nei PDF di preventivi e bozze fattura.
    </p>
    <TextInput source="businessProfile.name" label="Nome" />
    <TextInput source="businessProfile.tagline" label="Sottotitolo" />
    <TextInput source="businessProfile.vatNumber" label="P.IVA" />
    <TextInput source="businessProfile.fiscalCode" label="Codice Fiscale" />
    <TextInput source="businessProfile.sdiCode" label="Codice Univoco (SDI)" />
    <TextInput source="businessProfile.iban" label="IBAN" />
    <TextInput source="businessProfile.address" label="Indirizzo" />
    <TextInput source="businessProfile.email" label="Email" />
    <TextInput source="businessProfile.phone" label="Telefono" />
  </div>
);
