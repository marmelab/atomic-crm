import { useGetList, useInput } from "ra-core";
import { useWatch } from "react-hook-form";

import { ArrayInput } from "@/components/admin/array-input";
import { NumberInput } from "@/components/admin/number-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { TextInput } from "@/components/admin/text-input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { projectCategoryChoices } from "../projects/projectTypes";
import type { Client } from "../types";

const CURRENT_YEAR = new Date().getFullYear();

const asStringArray = (value: unknown) =>
  Array.isArray(value) ? value.map((item) => String(item)) : [];

const toggleValueInList = (
  current: string[],
  value: string,
  checked: boolean,
) => {
  if (checked) {
    return current.includes(value) ? current : [...current, value];
  }
  return current.filter((item) => item !== value);
};

export const FiscalSettingsSection = () => {
  const annoInizio = useWatch({ name: "fiscalConfig.annoInizioAttivita" });
  const aliquotaOverride = useWatch({ name: "fiscalConfig.aliquotaOverride" });

  const yearsActive = CURRENT_YEAR - (annoInizio || 2023);
  const isStartup = yearsActive < 5;
  const autoAliquota = isStartup ? 5 : 15;
  const effectiveAliquota = aliquotaOverride ?? autoAliquota;
  const lastStartupYear = (annoInizio || 2023) + 4;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Parametri per il calcolo di tasse e contributi nel Regime Forfettario. I
        dati sono usati nel simulatore fiscale della dashboard.
      </p>

      <div className="space-y-2">
        <h3 className="text-lg font-medium text-muted-foreground">
          Profili ATECO
        </h3>
        <p className="text-sm text-muted-foreground">
          Ogni codice ATECO ha un coefficiente di redditività diverso. Collega
          le categorie progetto al profilo corrispondente.
        </p>
        <ArrayInput
          source="fiscalConfig.taxProfiles"
          label={false}
          helperText={false}
        >
          <SimpleFormIterator disableReordering>
            <TextInput source="atecoCode" label="Codice ATECO" />
            <TextInput source="description" label="Descrizione" />
            <NumberInput
              source="coefficienteReddititivita"
              label="Coefficiente redditività %"
              min={0}
              max={100}
            />
            <LinkedCategoriesInput source="linkedCategories" />
          </SimpleFormIterator>
        </ArrayInput>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-muted-foreground">
          Parametri globali
        </h3>

        <NumberInput
          source="fiscalConfig.annoInizioAttivita"
          label="Anno inizio attività"
          min={2000}
          max={CURRENT_YEAR}
        />

        <div className="space-y-1">
          <Label className="text-sm font-medium">
            Aliquota imposta sostitutiva
          </Label>
          <div className="flex items-center gap-2">
            <Badge variant={effectiveAliquota === 5 ? "default" : "secondary"}>
              {effectiveAliquota}%{" "}
              {effectiveAliquota === 5 ? "(startup)" : "(ordinaria)"}
            </Badge>
          </div>
          {isStartup && aliquotaOverride == null && (
            <p className="text-xs text-muted-foreground">
              Aliquota startup 5% valida fino al {lastStartupYear}. Dal{" "}
              {lastStartupYear + 1} si applicherà automaticamente il 15%.
            </p>
          )}
          <AliquotaOverrideToggle />
        </div>

        <NumberInput
          source="fiscalConfig.aliquotaINPS"
          label="Aliquota INPS Gestione Separata %"
          min={0}
          max={50}
          step={0.01}
        />

        <NumberInput
          source="fiscalConfig.tettoFatturato"
          label="Tetto fatturato €"
          min={1}
          max={200000}
        />
      </div>

      <TaxabilityDefaultsInputs />
    </div>
  );
};

const LinkedCategoriesInput = ({ source }: { source: string }) => {
  const {
    field: { value = [], onChange },
  } = useInput({ source });

  const selected = asStringArray(value);

  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium">Categorie collegate</Label>
      <div className="flex flex-wrap gap-3">
        {projectCategoryChoices.map((category) => {
          const checked = selected.includes(category.id);

          return (
            <label
              key={category.id}
              className="flex items-center gap-1.5 text-sm cursor-pointer"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(nextChecked) =>
                  onChange(
                    toggleValueInList(
                      selected,
                      category.id,
                      nextChecked === true,
                    ),
                  )
                }
              />
              {category.name}
            </label>
          );
        })}
      </div>
      {selected.length === 0 ? (
        <p className="text-xs text-amber-600">Nessuna categoria collegata</p>
      ) : null}
    </div>
  );
};

const TaxabilityDefaultsInputs = () => {
  const {
    field: { value: categoriesValue = [], onChange: onCategoriesChange },
  } = useInput({
    source: "fiscalConfig.taxabilityDefaults.nonTaxableCategories",
  });
  const {
    field: { value: clientsValue = [], onChange: onClientsChange },
  } = useInput({
    source: "fiscalConfig.taxabilityDefaults.nonTaxableClientIds",
  });

  const selectedCategories = asStringArray(categoriesValue);
  const selectedClientIds = asStringArray(clientsValue);

  const { data: clients = [] } = useGetList<Client>("clients", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "name", order: "ASC" },
    filter: {},
  });

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-muted-foreground">
        Default tassabilità servizi
      </h3>
      <p className="text-sm text-muted-foreground">
        Queste regole impostano il default del flag &quot;Tassabile&quot; nei
        nuovi servizi e determinano quali incassi entrano nella base fiscale
        (principio di cassa). Il valore resta modificabile manualmente.
      </p>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Categorie non tassabili</Label>
        <div className="flex flex-wrap gap-3">
          {projectCategoryChoices.map((category) => {
            const checked = selectedCategories.includes(category.id);

            return (
              <label
                key={category.id}
                className="flex items-center gap-1.5 text-sm cursor-pointer"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(nextChecked) =>
                    onCategoriesChange(
                      toggleValueInList(
                        selectedCategories,
                        category.id,
                        nextChecked === true,
                      ),
                    )
                  }
                />
                {category.name}
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Clienti non tassabili</Label>
        {clients.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nessun cliente disponibile.
          </p>
        ) : (
          <div className="max-h-52 overflow-y-auto rounded-md border p-3 space-y-2">
            {clients.map((client) => {
              const clientId = String(client.id);
              const checked = selectedClientIds.includes(clientId);

              return (
                <label
                  key={clientId}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(nextChecked) =>
                      onClientsChange(
                        toggleValueInList(
                          selectedClientIds,
                          clientId,
                          nextChecked === true,
                        ),
                      )
                    }
                  />
                  {client.name}
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const AliquotaOverrideToggle = () => {
  const {
    field: { value, onChange },
  } = useInput({ source: "fiscalConfig.aliquotaOverride" });

  const hasOverride = value != null;

  return (
    <div className="flex items-center gap-2 mt-1">
      <Checkbox
        checked={hasOverride}
        onCheckedChange={(checked) => {
          onChange(checked ? 5 : undefined);
        }}
      />
      <span className="text-sm text-muted-foreground">
        Forza aliquota diversa
      </span>
      {hasOverride ? (
        <Select
          value={String(value)}
          onValueChange={(next) => onChange(Number(next))}
        >
          <SelectTrigger className="w-20 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">5%</SelectItem>
            <SelectItem value="15">15%</SelectItem>
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
};
