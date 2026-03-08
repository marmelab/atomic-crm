type AnnualOperationsGuidanceContext = {
  meta?: {
    selectedYear?: number;
    isCurrentYear?: boolean;
    asOfDateLabel?: string;
  };
  metrics?: Array<{
    id?: string;
    value?: number | null;
    formattedValue?: string;
  }>;
  topClients?: Array<{
    clientName?: string;
    revenue?: number;
  }>;
};

type BuildAnnualOperationsAiGuidanceArgs = {
  mode: "summary" | "answer";
  context: AnnualOperationsGuidanceContext;
  question?: string;
};

const getMetricValue = (
  context: AnnualOperationsGuidanceContext,
  metricId: string,
) => context.metrics?.find((metric) => metric.id === metricId)?.value ?? null;

export const buildAnnualOperationsAiGuidance = ({
  mode,
  context,
  question,
}: BuildAnnualOperationsAiGuidanceArgs) => {
  const selectedYear = context.meta?.selectedYear ?? "anno selezionato";
  const isCurrentYear = context.meta?.isCurrentYear === true;
  const asOfDateLabel = context.meta?.asOfDateLabel ?? "data indicata";
  const annualWorkValue = getMetricValue(context, "annual_work_value");
  const annualExpensesTotal = getMetricValue(
    context,
    "annual_expenses_total",
  );
  const pendingPaymentsTotal = getMetricValue(
    context,
    "pending_payments_total",
  );
  const openQuotesAmount = getMetricValue(context, "open_quotes_amount");
  const topClients = context.topClients ?? [];
  const firstClient = topClients[0];
  const singleClientCoversAllWork =
    topClients.length === 1 &&
    firstClient != null &&
    annualWorkValue != null &&
    Math.abs((firstClient.revenue ?? 0) - annualWorkValue) < 0.01;
  const normalizedQuestion = question?.trim().toLowerCase() ?? "";
  const lines = [
    isCurrentYear
      ? `Parla sempre di "${selectedYear} finora" oppure "fino al ${asOfDateLabel}".`
      : `Parla sempre di "nei dati registrati per il ${selectedYear}" oppure "nel perimetro del ${selectedYear}".`,
    isCurrentYear
      ? "Non usare formule da anno chiuso come se i dati coprissero gia gennaio-dicembre."
      : `Non usare "quest'anno", "oggi", "in questo momento" o "futuro" per riferirti al ${selectedYear}, perche e un anno gia chiuso.`,
    "Uno zero non e automaticamente un problema: descrivilo prima come assenza di record aperti nel perimetro osservato.",
    "Non trasformare mai uno zero in un'anomalia o in una diagnosi negativa senza una prova diretta nel contesto.",
    "Non suggerire che manchino registrazioni, dati o documenti se il contesto non lo dimostra esplicitamente o se l'utente non sta chiedendo una verifica dati.",
    'Se devi parlare di rischio o debolezza, usa formule prudenti come "segnale da controllare" o "segnale piu fragile visibile nei dati".',
    "Non presentare mai il perimetro dell'anno selezionato come se fosse l'intera situazione attuale dell'azienda.",
    mode === "summary"
      ? 'Nella sezione "Cosa controllare adesso", se non emerge un allarme vero dai dati, puoi dire che non emerge un controllo urgente dal solo perimetro osservato.'
      : 'Nella sezione "Cosa controllare adesso", proponi controlli solo se davvero supportati dai dati o richiesti dalla domanda.',
  ];

  if (annualExpensesTotal === 0) {
    lines.push(
      `Se le spese operative sono 0, limita la frase a "nel perimetro del ${selectedYear} non risultano spese registrate". Non chiamarlo problema automatico.`,
    );
  }

  if (isCurrentYear && annualExpensesTotal != null && annualExpensesTotal > 0) {
    lines.push(
      `Le spese e il margine lordo del ${selectedYear} sono provvisori perche l'anno non e chiuso. Presentali come stime parziali, non come risultato definitivo.`,
    );
  }

  if (pendingPaymentsTotal === 0) {
    lines.push(
      `Se i pagamenti da ricevere sono 0, limita la frase a "nel perimetro del ${selectedYear} non risultano incassi attesi aperti". Non chiamarlo problema automatico.`,
    );
  }

  if (openQuotesAmount === 0) {
    lines.push(
      `Se i preventivi aperti sono 0, limita la frase a "nel perimetro del ${selectedYear} non risultano preventivi aperti". Non chiamarlo automaticamente problema commerciale.`,
    );
  }

  if (singleClientCoversAllWork && firstClient?.clientName) {
    lines.push(
      `Se citi ${firstClient.clientName}, formula come "nei dati registrati per il ${selectedYear}, il valore del lavoro risulta associato a ${firstClient.clientName}". Evita frasi assolute come "tutto arriva da" o "l'azienda vive solo di".`,
    );
  }

  if (normalizedQuestion.includes("trainando")) {
    lines.push(
      "La domanda chiede cosa sta trainando: concentrati sui driver positivi dimostrabili come categoria principale, cliente dominante e mesi piu forti.",
    );
    lines.push(
      "Non chiudere la risposta con allarmi su zeri o mancanze se la domanda non lo chiede.",
    );
  }

  if (
    normalizedQuestion.includes("debole") ||
    normalizedQuestion.includes("fragile") ||
    normalizedQuestion.includes("segnale da controllare")
  ) {
    lines.push(
      'Se la domanda cerca un punto debole, rispondi come "segnale piu fragile visibile nei dati", non come verdetto assoluto sull\'azienda.',
    );
    if (singleClientCoversAllWork && firstClient?.clientName) {
      lines.push(
        `In questo contesto il segnale fragile piu supportato e la concentrazione su un solo cliente (${firstClient.clientName}), non i valori a 0 da soli.`,
      );
    }
    if (!isCurrentYear) {
      lines.push(
        `Per un anno chiuso come ${selectedYear}, non parlare di "prossimo lavoro", "futuro" o pipeline attuale come se descrivessero la situazione di oggi.`,
      );
    }
  }

  if (
    normalizedQuestion.includes("pagamenti") &&
    normalizedQuestion.includes("preventivi")
  ) {
    lines.push(
      "Se la domanda riguarda pagamenti e preventivi, spiega che cosa mostrano e che cosa non mostrano queste due metriche, senza inferire problemi nascosti.",
    );
    if (pendingPaymentsTotal === 0 && openQuotesAmount === 0) {
      lines.push(
        `Se entrambe le metriche sono a 0 nel ${selectedYear}, puoi dire che dai soli dati disponibili non emerge un controllo urgente su questo punto.`,
      );
    }
  }

  if (
    normalizedQuestion.includes("da chi arriva") ||
    normalizedQuestion.includes("da chi risulta")
  ) {
    lines.push(
      "Se la domanda chiede da chi arriva il valore del lavoro, resta sul perimetro dei clienti presenti nei dati registrati di quell'anno.",
    );
  }

  if (
    normalizedQuestion.includes("spes") ||
    normalizedQuestion.includes("costi") ||
    normalizedQuestion.includes("costo") ||
    normalizedQuestion.includes("margine")
  ) {
    lines.push(
      "Se la domanda riguarda spese o margini, usa la sezione expenses del contesto. Distingui il margine lordo operativo (lavoro - spese) dal reddito fiscale (che dipende da regime e aliquote, fuori da questo contesto).",
    );
    if (isCurrentYear) {
      lines.push(
        `Per il ${selectedYear} in corso, spese e margini sono provvisori: dillo esplicitamente.`,
      );
    }
  }

  return lines.map((line) => `- ${line}`).join("\n");
};

export const reframeAnnualOperationsQuestion = ({
  context,
  question,
}: Omit<BuildAnnualOperationsAiGuidanceArgs, "mode">) => {
  const selectedYear = context.meta?.selectedYear ?? "anno selezionato";
  const isCurrentYear = context.meta?.isCurrentYear === true;
  const normalizedQuestion = question.trim().toLowerCase();

  if (
    normalizedQuestion.includes("debole") ||
    normalizedQuestion.includes("fragile") ||
    normalizedQuestion.includes("segnale da controllare")
  ) {
    return `Qual e il segnale piu fragile visibile nei dati registrati per il ${selectedYear}? Rispondi solo con elementi supportati dal contesto. Non trattare valori a 0, da soli, come problemi automatici e non parlare di futuro o pipeline attuale se ${selectedYear} e un anno chiuso.`;
  }

  if (normalizedQuestion.includes("trainando")) {
    return isCurrentYear
      ? `Cosa sta trainando il ${selectedYear} finora nei dati registrati? Concentrati sui driver positivi dimostrabili e non chiudere con allarmi su valori a 0 se non richiesto.`
      : `Cosa ha trainato il ${selectedYear} nei dati registrati? Concentrati sui driver positivi dimostrabili e non chiudere con allarmi su valori a 0 se non richiesto.`;
  }

  if (
    normalizedQuestion.includes("pagamenti") &&
    normalizedQuestion.includes("preventivi")
  ) {
    return `Che cosa mostrano, e che cosa non mostrano, pagamenti da ricevere e preventivi aperti nel perimetro del ${selectedYear}? Descrivi i dati senza inferire problemi nascosti o registrazioni mancanti partendo da valori a 0.`;
  }

  if (
    normalizedQuestion.includes("da chi arriva") ||
    normalizedQuestion.includes("da chi risulta")
  ) {
    return `A quali clienti risulta associato il valore del lavoro nei dati registrati per il ${selectedYear}? Usa formule prudenti come "nei dati registrati per il ${selectedYear}" e non fare affermazioni assolute sull'intera azienda.`;
  }

  if (
    normalizedQuestion.includes("spes") ||
    normalizedQuestion.includes("costi") ||
    normalizedQuestion.includes("costo") ||
    normalizedQuestion.includes("margine")
  ) {
    const timeQualifier = isCurrentYear
      ? `finora nel ${selectedYear} (dati provvisori, anno non chiuso)`
      : `nei dati registrati per il ${selectedYear}`;
    return `Qual e il quadro delle spese operative e del margine lordo ${timeQualifier}? Usa la sezione expenses del contesto. Distingui il margine lordo operativo dal reddito fiscale. Non confondere spese operative con tasse o contributi.`;
  }

  return question.trim();
};
