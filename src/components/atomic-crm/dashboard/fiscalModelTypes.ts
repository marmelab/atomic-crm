// ── Fiscal model output types ────────────────────────────────────────

export type FiscalModel = {
  fiscalKpis: FiscalKpis;
  atecoBreakdown: AtecoBreakdownPoint[];
  deadlines: FiscalDeadline[];
  businessHealth: BusinessHealthKpis;
  warnings: FiscalWarning[];
};

export type FiscalKpis = {
  /** Incassi tassabili ricevuti nell'anno (principio di cassa, regime forfettario).
   *  Somma dei pagamenti con status="ricevuto" e payment_date nell'anno,
   *  mappati alle categorie ATECO tramite progetto. */
  fatturatoLordoYtd: number;
  /** Incassi totali ricevuti nell'anno, inclusi pagamenti non tassabili (principio di cassa). */
  fatturatoTotaleYtd: number;
  /** Quota non tassabile degli incassi dell'anno. */
  fatturatoNonTassabileYtd: number;
  /** SUM(fatturato_categoria × coefficiente_ATECO / 100). */
  redditoLordoForfettario: number;
  /** reddito_lordo × aliquota_INPS / 100. */
  stimaInpsAnnuale: number;
  /** reddito_lordo - INPS. */
  redditoImponibile: number;
  /** reddito_imponibile × aliquota_sostitutiva / 100. */
  stimaImpostaAnnuale: number;
  /** fatturato - INPS - imposta. */
  redditoNettoStimato: number;
  /** (reddito_netto / fatturato) × 100. */
  percentualeNetto: number;
  /** (INPS + imposta) / 12. */
  accantonamentoMensile: number;
  /** tetto - fatturato YTD. */
  distanzaDalTetto: number;
  /** (fatturato / tetto) × 100. */
  percentualeUtilizzoTetto: number;
  /** Effective aliquota sostitutiva used for calculations. */
  aliquotaSostitutiva: number;
  /** Number of months of data available (for reliability indicator). */
  monthsOfData: number;
};

export type AtecoBreakdownPoint = {
  atecoCode: string;
  description: string;
  coefficiente: number;
  fatturato: number;
  redditoForfettario: number;
  categories: string[];
};

export type FiscalDeadline = {
  date: string;
  label: string;
  items: DeadlineItem[];
  totalAmount: number;
  isPast: boolean;
  daysUntil: number;
  /** high = F24/INPS (prominent), low = bollo/dichiarazione (muted) */
  priority: "high" | "low";
  /** Amount actually paid (user-tracked). Null means not yet recorded. */
  paidAmount: number | null;
  /** Date when payment was made (ISO string). */
  paidDate: string | null;
};

export type DeadlineItem = {
  description: string;
  amount: number;
};

export type BusinessHealthKpis = {
  marginPerCategory: CategoryMargin[];
  quoteConversionRate: number;
  quotesAccepted: number;
  quotesTotal: number;
  dso: number | null;
  clientConcentration: number;
  weightedPipelineValue: number;
};

export type CategoryMargin = {
  category: string;
  label: string;
  margin: number;
  revenue: number;
  expenses: number;
};

export type FiscalWarning = {
  type: "unclassified_revenue" | "ceiling_exceeded" | "ceiling_critical";
  message: string;
  amount?: number;
};
