import { ArrayInput } from "@/components/admin/array-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { TextInput } from "@/components/admin/text-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { Separator } from "@/components/ui/separator";

import { contactRoleChoices } from "./contactRecord";

const personalInfoTypeChoices = [
  { id: "Work", name: "Lavoro" },
  { id: "Home", name: "Casa" },
  { id: "Other", name: "Altro" },
];

export const ContactInputs = () => (
  <div className="flex flex-col gap-6 p-1">
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Identità</h3>
        <TextInput source="first_name" label="Nome" helperText={false} />
        <TextInput source="last_name" label="Cognome" helperText={false} />
        <SelectInput
          source="contact_role"
          label="Ruolo strutturato"
          helperText="Serve a distinguere operativo, amministrazione, fatturazione e altri ruoli chiave."
          choices={contactRoleChoices}
          emptyText="Seleziona ruolo"
          parse={(value) => (value ? value : null)}
        />
        <TextInput
          source="title"
          label="Qualifica libera"
          helperText="Compila solo se ti serve una qualifica specifica oltre al ruolo strutturato."
        />
        <ReferenceInput
          source="client_id"
          reference="clients"
          sort={{ field: "name", order: "ASC" }}
        >
          <AutocompleteInput label="Cliente collegato" optionText="name" />
        </ReferenceInput>
        <BooleanInput
          source="is_primary_for_client"
          label="Referente principale per il cliente"
          helperText="Usalo quando questa è la persona di riferimento principale per quel cliente."
        />
        <ReferenceInput
          source="supplier_id"
          reference="suppliers"
          sort={{ field: "name", order: "ASC" }}
        >
          <AutocompleteInput label="Fornitore collegato" optionText="name" />
        </ReferenceInput>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Contatti</h3>
        <ArrayInput
          source="email_jsonb"
          label="Indirizzi email"
          helperText={false}
        >
          <SimpleFormIterator
            inline
            disableReordering
            className="[&>ul>li]:border-b-0 [&>ul>li]:pb-0"
          >
            <TextInput
              source="email"
              label={false}
              helperText={false}
              placeholder="Email"
              className="w-full"
            />
            <SelectInput
              source="type"
              label={false}
              helperText={false}
              optionText="name"
              choices={personalInfoTypeChoices}
              defaultValue="Work"
              className="w-24 min-w-24"
            />
          </SimpleFormIterator>
        </ArrayInput>
        <ArrayInput
          source="phone_jsonb"
          label="Numeri di telefono"
          helperText={false}
        >
          <SimpleFormIterator
            inline
            disableReordering
            className="[&>ul>li]:border-b-0 [&>ul>li]:pb-0"
          >
            <TextInput
              source="number"
              label={false}
              helperText={false}
              placeholder="Telefono"
              className="w-full"
            />
            <SelectInput
              source="type"
              label={false}
              helperText={false}
              optionText="name"
              choices={personalInfoTypeChoices}
              defaultValue="Work"
              className="w-24 min-w-24"
            />
          </SimpleFormIterator>
        </ArrayInput>
      </div>
    </div>

    <Separator />

    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Profilo</h3>
        <TextInput
          source="linkedin_url"
          label="URL LinkedIn"
          helperText={false}
        />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Note</h3>
        <TextInput
          source="background"
          label="Note contatto"
          helperText={false}
          multiline
        />
      </div>
    </div>
  </div>
);
