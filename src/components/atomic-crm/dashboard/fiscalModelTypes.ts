// ── Fiscal model output types ────────────────────────────────────────

export type FiscalModel = {
  fiscalKpis: FiscalKpis;
  atecoBreakdown: AtecoBreakdownPoint[];
  deadlines: FiscalDeadline[];
  businessHealth: BusinessHealthKpis;
  warnings: FiscalWarning[];
};

export type FiscalKpis = {
  /** Somma compensi netti (fee_shooting + fee_editing + fee_other - discount) anno corrente. */
  fatturatoLordoYtd: number;
  /** Somma compensi netti complessivi anno corrente, inclusi servizi non tassabili. */
  fatturatoTotaleYtd: number;
  /** Quota non tassabile del fatturato operativo dell'anno. */
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
