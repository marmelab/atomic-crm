import { required } from "ra-core";
import { TextInput } from "@/components/admin/text-input";
import { SelectInput } from "@/components/admin/select-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { Separator } from "@/components/ui/separator";
import { useWatch } from "react-hook-form";
import { ArrowRight, Zap } from "lucide-react";
import {
  triggerResourceChoices,
  triggerEventChoices,
  actionTypeChoices,
  statusChoicesForResource,
} from "./workflowTypes";

export const WorkflowInputs = () => {
  const triggerResource = useWatch({ name: "trigger_resource" });
  const triggerEvent = useWatch({ name: "trigger_event" });
  const actionType = useWatch({ name: "action_type" });

  const showStatusCondition =
    triggerEvent === "status_changed" &&
    statusChoicesForResource[triggerResource]?.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <TextInput
        source="name"
        label="Nome automazione"
        validate={required()}
        helperText="Un nome che ti aiuti a riconoscerla"
      />

      <TextInput
        source="description"
        label="Descrizione"
        multiline
        rows={2}
        helperText={false}
      />

      <Separator />

      {/* TRIGGER section */}
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Quando succede questo...</h3>
      </div>

      <SelectInput
        source="trigger_resource"
        label="Cosa monitorare"
        choices={triggerResourceChoices}
        optionText="label"
        optionValue="value"
        validate={required()}
        helperText={false}
      />

      <SelectInput
        source="trigger_event"
        label="Quale evento"
        choices={triggerEventChoices}
        optionText="label"
        optionValue="value"
        validate={required()}
        helperText={false}
      />

      {/* Smart condition: status dropdown instead of raw JSON */}
      {showStatusCondition && (
        <SelectInput
          source="condition_status"
          label="Quale stato"
          choices={statusChoicesForResource[triggerResource]}
          optionText="label"
          optionValue="value"
          helperText="Se vuoto, si attiva per qualsiasi cambio stato"
        />
      )}

      <Separator />

      {/* Arrow connector */}
      <div className="flex items-center gap-2">
        <ArrowRight className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">...allora fai questo</h3>
      </div>

      <SelectInput
        source="action_type"
        label="Azione da eseguire"
        choices={actionTypeChoices}
        optionText="label"
        optionValue="value"
        validate={required()}
        helperText={false}
      />

      {actionType === "create_task" && (
        <>
          <TextInput
            source="action_task_text"
            label="Testo del promemoria"
            validate={required()}
            helperText="Cosa deve ricordarti"
          />
          <TextInput
            source="action_task_due_days"
            label="Giorni per scadenza"
            defaultValue="3"
            helperText="Entro quanti giorni"
          />
        </>
      )}

      {actionType === "create_project" && (
        <p className="text-sm text-muted-foreground rounded-md bg-muted/50 p-3">
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
        label="Attiva subito"
        defaultValue={true}
      />
    </div>
  );
};
