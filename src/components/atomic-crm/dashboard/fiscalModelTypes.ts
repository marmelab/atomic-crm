// ── Fiscal model output types ────────────────────────────────────────

export type FiscalModel = {
  fiscalKpis: FiscalKpis;
  atecoBreakdown: AtecoBreakdownPoint[];
  schedule: FiscalPaymentSchedule;
  deadlines: FiscalDeadline[];
  businessHealth: BusinessHealthKpis;
  warnings: FiscalWarning[];
};

export type FiscalKpis = {
  taxYear: number;
  /** Incassi tassabili ricevuti nell'anno (principio di cassa, regime forfettario).
   *  Somma dei pagamenti con status="ricevuto" e payment_date nell'anno,
   *  mappati alle categorie ATECO tramite progetto. */
  fatturatoLordoYtd: number;
  /** Incassi totali ricevuti nell'anno, inclusi pagamenti non tassabili (principio di cassa). */
  fatturatoTotaleYtd: number;
  /** Quota non tassabile degli incassi dell'anno. */
  fatturatoNonTassabileYtd: number;
  /** Quota di incassi che resta fiscalmente non mappata a nessun profilo ATECO. */
  unmappedCashRevenue: number;
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

export type FiscalScheduleMethod = "historical";
export type FiscalScheduleConfidence = "estimated";

export type FiscalScheduleAssumptions = {
  configMode: "current_config_reapplied";
  paymentTrackingMode: "local_non_authoritative";
};

export type FiscalDeadlineComponent =
  | "imposta_saldo"
  | "imposta_acconto_1"
  | "imposta_acconto_2"
  | "imposta_acconto_unico"
  | "inps_saldo"
  | "inps_acconto_1"
  | "inps_acconto_2"
  | "bollo"
  | "dichiarazione";

export type FiscalScheduleItem = {
  description: string;
  amount: number;
  competenceYear: number | null;
  component: FiscalDeadlineComponent;
};

export type FiscalPaymentSchedule = {
  paymentYear: number;
  basisTaxYear: number;
  isFirstYear: boolean;
  supportingTaxYears: number[];
  method: FiscalScheduleMethod;
  confidence: FiscalScheduleConfidence;
  assumptions: FiscalScheduleAssumptions;
  deadlines: FiscalDeadline[];
};

export type FiscalDeadline = {
  paymentYear: number;
  method: FiscalScheduleMethod;
  supportingTaxYears: number[];
  confidence: FiscalScheduleConfidence;
  assumptions: FiscalScheduleAssumptions;
  date: string;
  label: string;
  items: FiscalScheduleItem[];
  totalAmount: number;
  isPast: boolean;
  daysUntil: number;
  /** high = F24/INPS (prominent), low = bollo/dichiarazione (muted) */
  priority: "high" | "low";
};

export type DeadlineItem = FiscalScheduleItem;

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

export type FiscalWarningCode =
  | "UNMAPPED_TAX_PROFILE"
  | "CEILING_EXCEEDED"
  | "CEILING_CRITICAL";

export type FiscalWarning = {
  code: FiscalWarningCode;
  severity: "warning" | "critical";
  message: string;
  amount?: number;
  taxYear?: number;
  paymentYear?: number;
};
