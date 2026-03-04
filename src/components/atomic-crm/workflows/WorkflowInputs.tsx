import { required } from "ra-core";
import { TextInput } from "@/components/admin/text-input";
import { SelectInput } from "@/components/admin/select-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { Separator } from "@/components/ui/separator";
import { useWatch } from "react-hook-form";
import {
  triggerResourceChoices,
  triggerEventChoices,
  actionTypeChoices,
} from "./workflowTypes";

export const WorkflowInputs = () => {
  const actionType = useWatch({ name: "action_type" });

  return (
    <div className="flex flex-col gap-4">
      <TextInput
        source="name"
        label="Nome workflow"
        validate={required()}
        helperText={false}
      />

      <TextInput
        source="description"
        label="Descrizione"
        multiline
        rows={2}
        helperText={false}
      />

      <Separator />

      <h3 className="text-sm font-semibold text-muted-foreground">Trigger</h3>

      <SelectInput
        source="trigger_resource"
        label="Risorsa"
        choices={triggerResourceChoices}
        optionText="label"
        optionValue="value"
        validate={required()}
        helperText="Quando questa risorsa..."
      />

      <SelectInput
        source="trigger_event"
        label="Evento"
        choices={triggerEventChoices}
        optionText="label"
        optionValue="value"
        validate={required()}
        helperText="...subisce questo evento..."
      />

      <TextInput
        source="trigger_conditions_json"
        label="Condizioni (JSON)"
        multiline
        rows={2}
        helperText='Opzionale. Es: {"status": "accettato"}'
        defaultValue="{}"
      />

      <Separator />

      <h3 className="text-sm font-semibold text-muted-foreground">Azione</h3>

      <SelectInput
        source="action_type"
        label="Tipo azione"
        choices={actionTypeChoices}
        optionText="label"
        optionValue="value"
        validate={required()}
        helperText="...esegui questa azione"
      />

      {actionType === "create_task" && (
        <>
          <TextInput
            source="action_task_text"
            label="Testo del promemoria"
            validate={required()}
            helperText={false}
          />
          <TextInput
            source="action_task_due_days"
            label="Giorni per scadenza"
            defaultValue="3"
            helperText="Quanti giorni da oggi per la scadenza"
          />
        </>
      )}

      {actionType === "create_project" && (
        <p className="text-sm text-muted-foreground">
          Il progetto verrà creato automaticamente dal preventivo con nome,
          cliente, budget e date.
        </p>
      )}

      {actionType === "update_field" && (
        <>
          <TextInput
            source="action_field_name"
            label="Campo da aggiornare"
            validate={required()}
            helperText={false}
          />
          <TextInput
            source="action_field_value"
            label="Nuovo valore"
            validate={required()}
            helperText={false}
          />
        </>
      )}

      <Separator />

      <BooleanInput
        source="is_active"
        label="Attivo"
        defaultValue={true}
      />
    </div>
  );
};
