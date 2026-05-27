import { useState } from "react";
import {
  useDataProvider,
  useNotify,
  useRecordContext,
  useRefresh,
} from "ra-core";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { ImportFilterConfig, LeadImportSource } from "../types";

function keywordsToString(arr: string[] | undefined): string {
  return (arr ?? []).join(", ");
}

function stringToKeywords(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const LeadImportFilterSettings = () => {
  const record = useRecordContext<LeadImportSource>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [minRevenue, setMinRevenue] = useState("");
  const [excludeHolding, setExcludeHolding] = useState(false);
  const [nameKeywords, setNameKeywords] = useState("");
  const [orgForms, setOrgForms] = useState("");
  const [minEmployees, setMinEmployees] = useState("");
  const [maxEmployees, setMaxEmployees] = useState("");
  const [includeVerksamhet, setIncludeVerksamhet] = useState("");
  const [excludeVerksamhet, setExcludeVerksamhet] = useState("");
  const [preQualifyWebsite, setPreQualifyWebsite] = useState(false);

  if (!record) return null;

  const loadFromRecord = () => {
    const cfg: ImportFilterConfig = record.filter_config ?? {};
    setMinRevenue(
      cfg.min_revenue_kkr != null ? String(cfg.min_revenue_kkr) : "",
    );
    setExcludeHolding(cfg.exclude_holding ?? false);
    setNameKeywords(keywordsToString(cfg.exclude_name_keywords));
    setOrgForms(keywordsToString(cfg.exclude_org_forms));
    setMinEmployees(cfg.min_employees != null ? String(cfg.min_employees) : "");
    setMaxEmployees(cfg.max_employees != null ? String(cfg.max_employees) : "");
    setIncludeVerksamhet(keywordsToString(cfg.include_verksamhet_keywords));
    setExcludeVerksamhet(keywordsToString(cfg.exclude_verksamhet_keywords));
    setPreQualifyWebsite(cfg.pre_qualify_website ?? false);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) loadFromRecord();
    setOpen(next);
  };

  const handleSave = async () => {
    const filter_config: ImportFilterConfig = {
      min_revenue_kkr: minRevenue.trim() ? Number(minRevenue) : null,
      exclude_holding: excludeHolding || undefined,
      exclude_name_keywords: stringToKeywords(nameKeywords),
      exclude_org_forms: stringToKeywords(orgForms),
      min_employees: minEmployees.trim() ? Number(minEmployees) : null,
      max_employees: maxEmployees.trim() ? Number(maxEmployees) : null,
      include_verksamhet_keywords: stringToKeywords(includeVerksamhet),
      exclude_verksamhet_keywords: stringToKeywords(excludeVerksamhet),
      pre_qualify_website: preQualifyWebsite || undefined,
    };

    try {
      setIsSaving(true);
      await dataProvider.update("lead_import_sources", {
        id: record.id,
        data: { filter_config },
        previousData: record,
      });
      notify("Filterinställningar sparade", { type: "success" });
      refresh();
      setOpen(false);
    } catch {
      notify("Kunde inte spara filterinställningar", { type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const hasActiveFilters =
    record.filter_config?.min_revenue_kkr != null ||
    record.filter_config?.exclude_holding ||
    (record.filter_config?.exclude_name_keywords ?? []).length > 0 ||
    (record.filter_config?.exclude_org_forms ?? []).length > 0 ||
    record.filter_config?.min_employees != null ||
    record.filter_config?.max_employees != null ||
    (record.filter_config?.include_verksamhet_keywords ?? []).length > 0 ||
    (record.filter_config?.exclude_verksamhet_keywords ?? []).length > 0 ||
    record.filter_config?.pre_qualify_website;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={hasActiveFilters ? "default" : "outline"}
          onClick={(e) => e.stopPropagation()}
          title="Filterinställningar"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {hasActiveFilters && <span className="ml-1">Aktiva filter</span>}
        </Button>
      </SheetTrigger>
      <SheetContent
        className="flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <SheetHeader className="shrink-0">
          <SheetTitle>Filterinställningar</SheetTitle>
          <p className="text-muted-foreground text-sm">
            Rader som matchar ett filter hoppas över vid import.
          </p>
        </SheetHeader>

        <div className="mt-6 flex flex-1 flex-col gap-5 overflow-y-auto pr-1">
          {/* Pre-qualify website */}
          <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
            <Switch
              id="pre-qualify-website"
              checked={preQualifyWebsite}
              onCheckedChange={setPreQualifyWebsite}
            />
            <div>
              <Label htmlFor="pre-qualify-website">
                Pre-kvalificera hemsida
              </Label>
              <p className="text-muted-foreground text-xs">
                Kontrollerar varje företags hemsida INNAN import. Företag med
                bra hemsidor (score &ge;70) importeras aldrig. Kostar 1
                Serper-anrop per företag. Rekommenderad batchstorlek: 30-50.
              </p>
            </div>
          </div>

          {/* Revenue */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="min-revenue">Minsta omsättning (kkr)</Label>
            <Input
              id="min-revenue"
              type="number"
              min={0}
              placeholder="t.ex. 500 = 500 000 kr"
              value={minRevenue}
              onChange={(e) => setMinRevenue(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Lämna tomt för att inte filtrera på omsättning.
            </p>
          </div>

          {/* Exclude holding */}
          <div className="flex items-center gap-3">
            <Switch
              id="exclude-holding"
              checked={excludeHolding}
              onCheckedChange={setExcludeHolding}
            />
            <div>
              <Label htmlFor="exclude-holding">Uteslut holdingbolag</Label>
              <p className="text-muted-foreground text-xs">
                Hoppar över rader där organisationsformen innehåller "holding".
              </p>
            </div>
          </div>

          {/* Name keywords */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name-keywords">Uteslut nyckelord i namn</Label>
            <Input
              id="name-keywords"
              type="text"
              placeholder="t.ex. holding, invest, förvaltning"
              value={nameKeywords}
              onChange={(e) => setNameKeywords(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Kommaseparerade ord. Rader vars företagsnamn innehåller något av
              orden hoppas över.
            </p>
          </div>

          {/* Org forms */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="org-forms">Uteslut organisationsformer</Label>
            <Input
              id="org-forms"
              type="text"
              placeholder="t.ex. Holdingbolag, Ideell förening"
              value={orgForms}
              onChange={(e) => setOrgForms(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Kommaseparerade. Matchar delsträngar i organisationsform (ej
              skiftlägeskänsligt).
            </p>
          </div>

          {/* Include verksamhet */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="include-verksamhet">
              Inkludera verksamhetsbeskrivning
            </Label>
            <Input
              id="include-verksamhet"
              type="text"
              placeholder="t.ex. restaurang, frisör, bygg, verkstad, café"
              value={includeVerksamhet}
              onChange={(e) => setIncludeVerksamhet(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Kommaseparerade. Bara företag vars verksamhetsbeskrivning matchar
              minst ett av orden importeras. Lämna tomt för att inte filtrera.
            </p>
          </div>

          {/* Exclude verksamhet */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exclude-verksamhet">
              Uteslut verksamhetsbeskrivning
            </Label>
            <Input
              id="exclude-verksamhet"
              type="text"
              placeholder="t.ex. förvaltning, fastighet, jordbruk, skogsbruk"
              value={excludeVerksamhet}
              onChange={(e) => setExcludeVerksamhet(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Kommaseparerade. Företag vars verksamhetsbeskrivning matchar något
              av orden hoppas över.
            </p>
          </div>

          {/* Employees */}
          <div className="flex flex-col gap-1.5">
            <Label>Antal anställda</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                placeholder="Min"
                value={minEmployees}
                onChange={(e) => setMinEmployees(e.target.value)}
                className="w-28"
              />
              <span className="text-muted-foreground text-sm">–</span>
              <Input
                type="number"
                min={0}
                placeholder="Max"
                value={maxEmployees}
                onChange={(e) => setMaxEmployees(e.target.value)}
                className="w-28"
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Lämna tomt för att inte filtrera på antal anställda.
            </p>
          </div>
        </div>

        <div className="mt-4 shrink-0 border-t pt-4 flex gap-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Sparar..." : "Spara filter"}
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Avbryt
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
