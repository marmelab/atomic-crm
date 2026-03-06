import { Loader2, Route } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDataProvider, useNotify } from "ra-core";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { calculateKmReimbursement } from "@/lib/semantics/crmSemanticRegistry";
import type {
  TravelRouteEstimate,
  TravelRouteLocationSuggestion,
  TravelRouteTripMode,
} from "@/lib/travelRouteEstimate";

import type { CrmDataProvider } from "../providers/types";

type TravelRouteCalculatorDialogProps = {
  defaultKmRate: number;
  defaultTravelOrigin?: string;
  currentKmRate?: number | null;
  initialDestination?: string;
  triggerLabel?: string;
  onApply: (estimate: TravelRouteEstimate) => void;
};

const toRateValue = (
  value: number | "" | null | undefined,
  fallback: number,
) => {
  if (value === "" || value == null) return fallback;
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
};

const roundCurrency = (value: number) => Number(value.toFixed(2));
const locationSuggestMinChars = 3;
const locationSuggestDebounceMs = 250;

const useTravelLocationSuggestions = ({
  query,
  enabled,
  dataProvider,
}: {
  query: string;
  enabled: boolean;
  dataProvider: CrmDataProvider;
}) => {
  const [suggestions, setSuggestions] = useState<
    TravelRouteLocationSuggestion[]
  >([]);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmedQuery = query.trim();
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    if (!enabled || trimmedQuery.length < locationSuggestMinChars) {
      setSuggestions((currentSuggestions) =>
        currentSuggestions.length === 0 ? currentSuggestions : [],
      );
      setIsPending(false);
      setErrorMessage(null);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setIsPending(true);
      try {
        const nextSuggestions = await dataProvider.suggestTravelLocations({
          query: trimmedQuery,
        });

        if (requestIdRef.current !== requestId) {
          return;
        }

        setSuggestions(nextSuggestions);
        setErrorMessage(null);
      } catch (error) {
        if (requestIdRef.current !== requestId) {
          return;
        }

        setSuggestions([]);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Impossibile cercare i luoghi richiesti.",
        );
      } finally {
        if (requestIdRef.current === requestId) {
          setIsPending(false);
        }
      }
    }, locationSuggestDebounceMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [dataProvider, enabled, query]);

  return {
    suggestions,
    isPending,
    errorMessage,
  };
};

const TravelLocationAutocompleteField = ({
  id,
  label,
  value,
  placeholder,
  suggestions,
  isPending,
  errorMessage,
  isOpen,
  onFocus,
  onBlur,
  onChange,
  onSelect,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  suggestions: TravelRouteLocationSuggestion[];
  isPending: boolean;
  errorMessage: string | null;
  isOpen: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onChange: (value: string) => void;
  onSelect: (suggestion: TravelRouteLocationSuggestion) => void;
}) => (
  <div className="grid gap-2">
    <Label htmlFor={id}>{label}</Label>
    <div className="relative">
      <Input
        id={id}
        value={value}
        onFocus={onFocus}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />

      {isOpen ? (
        <div className="absolute top-full z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <Command shouldFilter={false}>
            <CommandList className="max-h-56">
              {isPending ? (
                <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Sto cercando luoghi...
                </div>
              ) : null}

              {!isPending && errorMessage ? (
                <div className="px-3 py-3 text-sm text-muted-foreground">
                  {errorMessage}
                </div>
              ) : null}

              {!isPending && !errorMessage ? (
                <>
                  <CommandEmpty>Nessun luogo trovato</CommandEmpty>
                  <CommandGroup>
                    {suggestions.map((suggestion) => (
                      <CommandItem
                        key={`${suggestion.label}-${suggestion.longitude}-${suggestion.latitude}`}
                        value={suggestion.label}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onSelect={() => onSelect(suggestion)}
                        className="cursor-pointer"
                      >
                        {suggestion.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              ) : null}
            </CommandList>
          </Command>
        </div>
      ) : null}
    </div>
  </div>
);

export const TravelRouteCalculatorDialog = ({
  defaultKmRate,
  defaultTravelOrigin,
  currentKmRate,
  initialDestination,
  triggerLabel = "Calcola tratta",
  onApply,
}: TravelRouteCalculatorDialogProps) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState(initialDestination ?? "");
  const [tripMode, setTripMode] = useState<TravelRouteTripMode>("round_trip");
  const [kmRate, setKmRate] = useState<number | "">(
    toRateValue(currentKmRate, defaultKmRate),
  );
  const [estimate, setEstimate] = useState<TravelRouteEstimate | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [activeAutocompleteField, setActiveAutocompleteField] = useState<
    "origin" | "destination" | null
  >(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setOrigin(defaultTravelOrigin ?? "");
    setDestination(initialDestination ?? "");
    setTripMode("round_trip");
    setKmRate(toRateValue(currentKmRate, defaultKmRate));
    setEstimate(null);
    setActiveAutocompleteField(null);
  }, [
    open,
    defaultTravelOrigin,
    initialDestination,
    currentKmRate,
    defaultKmRate,
  ]);

  const normalizedKmRate = toRateValue(kmRate, defaultKmRate);
  const displayEstimate = useMemo(() => {
    if (!estimate) {
      return null;
    }

    const reimbursementAmount =
      estimate.kmRate === normalizedKmRate &&
      estimate.reimbursementAmount != null
        ? estimate.reimbursementAmount
        : roundCurrency(
            calculateKmReimbursement({
              kmDistance: estimate.totalDistanceKm,
              kmRate: normalizedKmRate,
              defaultKmRate,
            }),
          );

    return {
      ...estimate,
      kmRate: normalizedKmRate,
      reimbursementAmount,
    };
  }, [defaultKmRate, estimate, normalizedKmRate]);

  const invalidateEstimate = () => {
    setEstimate(null);
  };

  const {
    suggestions: originSuggestions,
    isPending: isOriginSuggesting,
    errorMessage: originSuggestionError,
  } = useTravelLocationSuggestions({
    query: origin,
    enabled: open && activeAutocompleteField === "origin",
    dataProvider,
  });
  const {
    suggestions: destinationSuggestions,
    isPending: isDestinationSuggesting,
    errorMessage: destinationSuggestionError,
  } = useTravelLocationSuggestions({
    query: destination,
    enabled: open && activeAutocompleteField === "destination",
    dataProvider,
  });
  const showOriginSuggestions =
    activeAutocompleteField === "origin" &&
    origin.trim().length >= locationSuggestMinChars &&
    (isOriginSuggesting ||
      originSuggestions.length > 0 ||
      originSuggestionError !== null);
  const showDestinationSuggestions =
    activeAutocompleteField === "destination" &&
    destination.trim().length >= locationSuggestMinChars &&
    (isDestinationSuggesting ||
      destinationSuggestions.length > 0 ||
      destinationSuggestionError !== null);

  const calculate = async () => {
    if (!origin.trim()) {
      notify("Inserisci un luogo di partenza prima di calcolare i km.", {
        type: "warning",
      });
      return;
    }

    if (!destination.trim()) {
      notify("Inserisci un luogo di arrivo prima di calcolare i km.", {
        type: "warning",
      });
      return;
    }

    setIsCalculating(true);
    try {
      const nextEstimate = await dataProvider.estimateTravelRoute({
        origin,
        destination,
        tripMode,
        kmRate: normalizedKmRate,
      });
      setEstimate(nextEstimate);
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Impossibile calcolare la tratta richiesta.",
        {
          type: "error",
        },
      );
    } finally {
      setIsCalculating(false);
    }
  };

  const applyEstimate = () => {
    if (!displayEstimate) {
      return;
    }

    onApply(displayEstimate);
    setOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setOpen(true)}
        aria-label="Apri calcolatore tratta km"
      >
        <Route className="size-4" />
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[max(1rem,env(safe-area-inset-top))] flex max-h-[calc(100dvh-2rem)] flex-col translate-y-0 overflow-hidden p-0 sm:top-[50%] sm:max-h-[min(90dvh,48rem)] sm:translate-y-[-50%] sm:max-w-xl">
          <DialogHeader className="shrink-0 px-6 pt-6">
            <DialogTitle>Calcola tratta km</DialogTitle>
            <DialogDescription>
              Inserisci partenza, arrivo, tipo di tratta e tariffa km per
              precompilare i campi di spostamento.
            </DialogDescription>
          </DialogHeader>

          <div
            data-testid="travel-route-dialog-body"
            className="min-h-0 flex-1 overflow-y-auto px-6 pb-4"
          >
            <div className="grid gap-4">
              <TravelLocationAutocompleteField
                id="travel-route-origin"
                label="Luogo di partenza"
                value={origin}
                placeholder="Es. Valguarnera Caropepe"
                suggestions={originSuggestions}
                isPending={isOriginSuggesting}
                errorMessage={originSuggestionError}
                isOpen={showOriginSuggestions}
                onFocus={() => setActiveAutocompleteField("origin")}
                onBlur={() => {
                  setActiveAutocompleteField((current) =>
                    current === "origin" ? null : current,
                  );
                }}
                onChange={(value) => {
                  setOrigin(value);
                  invalidateEstimate();
                }}
                onSelect={(suggestion) => {
                  setOrigin(suggestion.label);
                  setActiveAutocompleteField(null);
                  invalidateEstimate();
                }}
              />

              <TravelLocationAutocompleteField
                id="travel-route-destination"
                label="Luogo di arrivo"
                value={destination}
                placeholder="Es. Catania"
                suggestions={destinationSuggestions}
                isPending={isDestinationSuggesting}
                errorMessage={destinationSuggestionError}
                isOpen={showDestinationSuggestions}
                onFocus={() => setActiveAutocompleteField("destination")}
                onBlur={() => {
                  setActiveAutocompleteField((current) =>
                    current === "destination" ? null : current,
                  );
                }}
                onChange={(value) => {
                  setDestination(value);
                  invalidateEstimate();
                }}
                onSelect={(suggestion) => {
                  setDestination(suggestion.label);
                  setActiveAutocompleteField(null);
                  invalidateEstimate();
                }}
              />

              <div className="grid gap-2">
                <Label>Tipo di tratta</Label>
                <RadioGroup
                  value={tripMode}
                  onValueChange={(value) => {
                    if (value === "one_way" || value === "round_trip") {
                      setTripMode(value);
                      invalidateEstimate();
                    }
                  }}
                  className="grid gap-2 sm:grid-cols-2"
                >
                  <label
                    htmlFor="travel-trip-one-way"
                    className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"
                  >
                    <RadioGroupItem id="travel-trip-one-way" value="one_way" />
                    <span className="text-sm font-medium">Solo andata</span>
                  </label>
                  <label
                    htmlFor="travel-trip-round-trip"
                    className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"
                  >
                    <RadioGroupItem
                      id="travel-trip-round-trip"
                      value="round_trip"
                    />
                    <span className="text-sm font-medium">
                      Andata e ritorno
                    </span>
                  </label>
                </RadioGroup>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="travel-route-km-rate">Tariffa EUR/km</Label>
                <Input
                  id="travel-route-km-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={kmRate}
                  onChange={(event) => {
                    setKmRate(
                      event.target.value === ""
                        ? ""
                        : Number(event.target.value),
                    );
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Valore iniziale condiviso: EUR{" "}
                  {defaultKmRate.toLocaleString("it-IT", {
                    minimumFractionDigits: 2,
                  })}
                  /km
                </p>
              </div>

              {displayEstimate ? (
                <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                  <div className="grid gap-1">
                    <p className="font-medium">Tratta risolta</p>
                    <p className="text-muted-foreground">
                      {displayEstimate.originLabel} →{" "}
                      {displayEstimate.destinationLabel}
                    </p>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Km a tratta
                      </p>
                      <p className="font-semibold">
                        {displayEstimate.oneWayDistanceKm.toLocaleString(
                          "it-IT",
                          {
                            minimumFractionDigits: 2,
                          },
                        )}{" "}
                        km
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Km totali
                      </p>
                      <p className="font-semibold">
                        {displayEstimate.totalDistanceKm.toLocaleString(
                          "it-IT",
                          {
                            minimumFractionDigits: 2,
                          },
                        )}{" "}
                        km
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Durata totale stimata
                      </p>
                      <p className="font-semibold">
                        {displayEstimate.totalDurationMinutes.toLocaleString(
                          "it-IT",
                          {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          },
                        )}{" "}
                        min
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Rimborso stimato
                      </p>
                      <p className="font-semibold">
                        EUR{" "}
                        {displayEstimate.reimbursementAmount?.toLocaleString(
                          "it-IT",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          },
                        ) ?? "0,00"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annulla
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={calculate}
              disabled={isCalculating}
            >
              {isCalculating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Route className="size-4" />
              )}
              Calcola
            </Button>
            <Button
              type="button"
              onClick={applyEstimate}
              disabled={!displayEstimate || isCalculating}
            >
              Applica
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
