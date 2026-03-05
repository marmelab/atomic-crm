import { useCallback, useEffect, useRef, useState } from "react";
import { useListContext, type Exporter } from "ra-core";
import { downloadCSVItalian } from "@/lib/downloadCsvItalian";
import { matchPath, useLocation } from "react-router";
import { Search, X } from "lucide-react";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { CreateButton } from "@/components/admin/create-button";
import { ExportButton } from "@/components/admin/export-button";
import { FilterButton } from "@/components/admin/filter-form";
import { List } from "@/components/admin/list";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SearchInput } from "@/components/admin/search-input";
import { TextInput } from "@/components/admin/text-input";
import { DateInput } from "@/components/admin/date-input";
import { SelectInput } from "@/components/admin/select-input";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import type { Client, Project, Quote } from "../types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { TopToolbar } from "../layout/TopToolbar";
import { QuoteCreate } from "./QuoteCreate";
import { QuoteEdit } from "./QuoteEdit";
import { QuoteEmpty } from "./QuoteEmpty";
import { QuoteListContent } from "./QuoteListContent";
import { QuoteShow } from "./QuoteShow";
import { quoteStatusLabels } from "./quotesTypes";
import { buildNameSearchFilter } from "../misc/referenceSearch";
import { MobilePageTitle } from "../layout/MobilePageTitle";

const QuoteList = () => {
  const { quoteServiceTypes } = useConfigurationContext();
  const isMobile = useIsMobile();

  const quoteFilters = [
    isMobile ? (
      <TextInput source="q" label="Ricerca" />
    ) : (
      <SearchInput source="q" alwaysOn />
    ),
    <ReferenceInput source="client_id" reference="clients">
      <AutocompleteInput
        label={false}
        placeholder="Cliente"
        optionText="name"
        filterToQuery={buildNameSearchFilter}
      />
    </ReferenceInput>,
    <SelectInput
      source="service_type"
      emptyText="Tipo servizio"
      choices={quoteServiceTypes}
      optionText="label"
      optionValue="value"
    />,
    <DateInput source="event_start@gte" label="Evento da" />,
    <DateInput source="event_start@lte" label="Evento a" />,
  ];

  const typeLabels: Record<string, string> = Object.fromEntries(
    quoteServiceTypes.map((t) => [t.value, t.label]),
  );

  const exporter: Exporter<Quote> = async (records, fetchRelatedRecords) => {
    const clients = await fetchRelatedRecords<Client>(
      records,
      "client_id",
      "clients",
    );
    const projects = await fetchRelatedRecords<Project>(
      records.filter((quote) => !!quote.project_id),
      "project_id",
      "projects",
    );
    const rows = records.map((q) => ({
      descrizione: q.description ?? "",
      cliente: clients[q.client_id]?.name ?? "",
      progetto_collegato: q.project_id
        ? (projects[q.project_id]?.name ?? "")
        : "",
      tipo_servizio: typeLabels[q.service_type] ?? q.service_type,
      data_inizio_evento: q.event_start ?? "",
      data_fine_evento: q.event_end ?? "",
      tutto_il_giorno: q.all_day ? "Sì" : "No",
      importo: q.amount,
      stato: quoteStatusLabels[q.status] ?? q.status,
      data_invio: q.sent_date ?? "",
      data_risposta: q.response_date ?? "",
      motivo_rifiuto: q.rejection_reason ?? "",
      note: q.notes ?? "",
    }));
    downloadCSVItalian(rows, "preventivi");
  };

  return (
    <List
      perPage={100}
      title={false}
      sort={{ field: "index", order: "DESC" }}
      filters={quoteFilters}
      actions={<QuoteActions />}
      pagination={null}
      exporter={exporter}
    >
      <QuoteLayout />
    </List>
  );
};

const QuoteLayout = () => {
  const location = useLocation();
  const matchCreate = matchPath("/quotes/create", location.pathname);
  const matchShow = matchPath("/quotes/:id/show", location.pathname);
  const matchEdit = matchPath("/quotes/:id", location.pathname);

  const { data, isPending, filterValues } = useListContext();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;
  if (!data?.length && !hasFilters && !matchCreate) return <QuoteEmpty />;

  return (
    <>
      <MobilePageTitle title="Preventivi" />
      <div className="w-full">
        <QuoteListContent />
        <QuoteCreate open={!!matchCreate} />
        <QuoteEdit
          open={!!matchEdit && !matchCreate && !matchShow}
          id={matchEdit?.params.id}
        />
        <QuoteShow open={!!matchShow} id={matchShow?.params.id} />
      </div>
    </>
  );
};

const QuoteActions = () => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <TopToolbar className="w-full justify-between">
        <MobileSearchInput />
        <div className="flex items-center gap-1">
          <FilterButton label="" />
          <ExportButton label="" />
          <CreateButton label="Nuovo" />
        </div>
      </TopToolbar>
    );
  }

  return (
    <TopToolbar>
      <FilterButton />
      <ExportButton />
      <CreateButton label="Nuovo Preventivo" />
    </TopToolbar>
  );
};

const SEARCH_DEBOUNCE_MS = 300;

const MobileSearchInput = () => {
  const { filterValues, setFilters } = useListContext();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(filterValues?.q ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const applyFilter = useCallback(
    (v: string) => {
      setFilters({ ...filterValues, q: v || undefined }, undefined, true);
    },
    [filterValues, setFilters],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setValue(v);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => applyFilter(v), SEARCH_DEBOUNCE_MS);
    },
    [applyFilter],
  );

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const handleClear = useCallback(() => {
    setValue("");
    clearTimeout(debounceRef.current);
    applyFilter("");
    setOpen(false);
  }, [applyFilter]);

  const hasActiveSearch = !!filterValues?.q;

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className={cn("h-9 w-9", hasActiveSearch && "border-primary text-primary")}
        onClick={() => {
          setValue(filterValues?.q ?? "");
          setOpen(true);
        }}
      >
        <Search className="h-4 w-4" />
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b shadow-lg px-4 py-3 flex items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              autoFocus
              value={value}
              onChange={handleChange}
              placeholder="Cerca preventivi…"
              className="h-9 flex-1 text-sm border-0 shadow-none focus-visible:ring-0"
            />
            {value && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={handleClear}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground"
              onClick={() => setOpen(false)}
            >
              Chiudi
            </Button>
          </div>
        </>
      )}
    </>
  );
};

export default QuoteList;
