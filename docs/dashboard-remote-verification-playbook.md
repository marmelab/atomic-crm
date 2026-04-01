# Dashboard Remote Verification Playbook

Stato del documento: reference

Scopo:
- tenere traccia della procedura usata per validare la bacheca remota in modo ripetibile
- permettere una nuova verifica futura senza ricostruire i passaggi dalla chat

Quando usarlo:
- quando bisogna verificare la bacheca annuale e storica sul progetto remoto reale
- quando bisogna confrontare UI live e dati sottostanti dopo un refactor dashboard o analytics
- quando servono screenshot, body text e ricostruzione numerica con gli stessi builder del frontend

Quando NON usarlo:
- per regressioni UI locali su dataset tecnico deterministico: in quel caso usare i test Playwright in `tests/e2e/**`
- per validare singole card di CRM show page (`clients`, `projects`) che non fanno parte della bacheca
- per verifiche solo DB senza UI browser

File/moduli correlati:
- `scripts/auth-smoke-user.mjs`
- `src/components/atomic-crm/dashboard/useDashboardData.ts`
- `src/components/atomic-crm/dashboard/useHistoricalDashboardData.ts`
- `src/components/atomic-crm/dashboard/dashboardModel.ts`
- `src/components/atomic-crm/dashboard/dashboardHistoryModel.ts`
- `src/lib/analytics/buildHistoricalCashInflowContext.ts`
- `docs/development-continuity-map.md`

## Obiettivo della verifica

La procedura chiude quattro livelli, in quest'ordine:

1. login reale sulla UI remota
2. evidenza visuale della bacheca annuale e storica
3. export del testo renderizzato (`body`) per confronto rapido
4. ricostruzione dei modelli annuale/storico con gli stessi builder TypeScript del frontend, usando il dataset remoto

La verifica e' chiusa solo se:

- la UI carica senza errori browser
- le card principali mostrano i valori attesi
- i numeri ricostruiti dai builder coincidono con la UI

## Prerequisiti

- repo locale aggiornato
- `.env.production` presente con:
  - `VITE_SUPABASE_URL`
  - `VITE_SB_PUBLISHABLE_KEY`
- accesso al progetto Supabase remoto tramite CLI
- `agent-browser` disponibile

Installazione `agent-browser` se manca:

```bash
npm install -g agent-browser@0.23.4
```

Verifica installazione:

```bash
which agent-browser
agent-browser --version
```

## Test usati

La validazione remota della bacheca usa sempre questi test:

1. smoke auth remoto con utente temporaneo
2. browser smoke annuale con `agent-browser`
3. browser smoke storico con `agent-browser`
4. check `console` ed `errors` del browser
5. ricostruzione modello annuale con `buildDashboardModel`
6. ricostruzione modello storico con `buildDashboardHistoryModel`
7. ricostruzione card storico incassi con `buildHistoricalCashInflowContext`
8. ricostruzione deadline tracker con `buildDashboardDeadlineTrackerComputed`

## Step 1 - Creare utente smoke remoto

```bash
cd /Users/rosariofurnari/Documents/gestionale-rosario
node scripts/auth-smoke-user.mjs create --target remote
```

Salvare questi campi dall'output JSON:

- `email`
- `password`
- `userId`

Serviranno per login e cleanup finale.

## Step 2 - Browser smoke annuale

Aprire la login remota:

```bash
mkdir -p /tmp/gestionale-bacheca-shots
agent-browser --session-name gestionale-bacheca \
  --allowed-domains 'gestionale-rosario.vercel.app,*.supabase.co' \
  open https://gestionale-rosario.vercel.app
agent-browser --session-name gestionale-bacheca wait 3000
agent-browser --session-name gestionale-bacheca snapshot -i
```

Compilare login con le ref correnti del form:

```bash
agent-browser --session-name gestionale-bacheca fill @e6 '<SMOKE_EMAIL>'
agent-browser --session-name gestionale-bacheca fill @e7 '<SMOKE_PASSWORD>'
agent-browser --session-name gestionale-bacheca click @e5
agent-browser --session-name gestionale-bacheca wait 5000
```

Salvare evidenze annuali:

```bash
agent-browser --session-name gestionale-bacheca screenshot /tmp/gestionale-bacheca-shots/bacheca-home.png
agent-browser --session-name gestionale-bacheca screenshot /tmp/gestionale-bacheca-shots/bacheca-annuale-full.png --full
agent-browser --session-name gestionale-bacheca get text body > /tmp/gestionale-bacheca-shots/bacheca-annuale-text.txt
```

## Step 3 - Browser smoke storico

Dalla bacheca gia' loggata:

```bash
agent-browser --session-name gestionale-bacheca snapshot -i
```

Poi cliccare il radio `Storico` con la ref corrente e aspettare il caricamento:

```bash
agent-browser --session-name gestionale-bacheca click @e36
agent-browser --session-name gestionale-bacheca wait 9000
agent-browser --session-name gestionale-bacheca screenshot /tmp/gestionale-bacheca-shots/bacheca-storica-full.png --full
agent-browser --session-name gestionale-bacheca get text body > /tmp/gestionale-bacheca-shots/bacheca-storica-text.txt
```

## Step 4 - Errori browser

```bash
agent-browser --session-name gestionale-bacheca errors
agent-browser --session-name gestionale-bacheca console
```

Esito atteso:

- output vuoto su `errors`
- output vuoto o solo log innocui su `console`

## Step 5 - Ricostruzione dati con gli stessi builder del frontend

Questo check usa il dataset remoto e le stesse funzioni TypeScript che usa la UI.

Eseguire:

```bash
cd /Users/rosariofurnari/Documents/gestionale-rosario
EMAIL='<SMOKE_EMAIL>' PASSWORD='<SMOKE_PASSWORD>' npx tsx <<'TS'
import fs from "node:fs/promises";
import { buildDashboardModel } from "./src/components/atomic-crm/dashboard/dashboardModel.ts";
import { buildDashboardHistoryModel } from "./src/components/atomic-crm/dashboard/dashboardHistoryModel.ts";
import { buildHistoricalCashInflowContext } from "./src/lib/analytics/buildHistoricalCashInflowContext.ts";
import { buildDashboardDeadlineTrackerComputed } from "./src/components/atomic-crm/dashboard/dashboardDeadlineTrackerModel.ts";
import { mergeConfigurationWithDefaults } from "./src/components/atomic-crm/root/ConfigurationContext.tsx";
import { addDaysToISODate, todayISODate } from "./src/lib/dateTimezone.ts";

const envText = await fs.readFile(".env.production", "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx), line.slice(idx + 1)];
    }),
);

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SB_PUBLISHABLE_KEY;

const authResponse = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: {
    apikey: key,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
  }),
});

if (!authResponse.ok) {
  throw new Error(`auth failed: ${authResponse.status} ${await authResponse.text()}`);
}

const auth = await authResponse.json();
const authHeaders = {
  apikey: key,
  Authorization: `Bearer ${auth.access_token}`,
};

async function list(resource, params = {}) {
  const search = new URLSearchParams();
  search.set("select", params.select ?? "*");
  search.set("limit", String(params.limit ?? 1000));
  if (params.order) search.set("order", params.order);
  for (const filter of params.filters ?? []) {
    const [k, ...rest] = filter.split("=");
    search.append(k, rest.join("="));
  }
  const response = await fetch(`${url}/rest/v1/${resource}?${search.toString()}`, {
    headers: authHeaders,
  });
  if (!response.ok) {
    throw new Error(`${resource} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

const [
  configurationRows,
  payments,
  quotes,
  services,
  projects,
  clients,
  expenses,
  clientTasks,
  metaRows,
  yearlyRevenueRows,
  categoryRows,
  topClientRows,
  yearlyCashInflowRows,
] = await Promise.all([
  list("configuration", { filters: ["id=eq.1"], limit: 1 }),
  list("payments"),
  list("quotes"),
  list("services"),
  list("projects"),
  list("clients"),
  list("expenses"),
  list("client_tasks"),
  list("analytics_history_meta", { filters: ["id=eq.1"], limit: 1 }),
  list("analytics_yearly_competence_revenue", { order: "year.asc" }),
  list("analytics_yearly_competence_revenue_by_category", {
    order: "year.asc,category.asc",
  }),
  list("analytics_client_lifetime_competence_revenue", {
    order: "lifetime_revenue.desc",
    limit: 10,
  }),
  list("analytics_yearly_cash_inflow", { order: "year.asc" }),
]);

const configuration = mergeConfigurationWithDefaults(configurationRows[0]?.config ?? {});
const annual = buildDashboardModel({
  payments,
  quotes,
  services,
  projects,
  clients,
  expenses,
  fiscalConfig: configuration.fiscalConfig,
  year: 2026,
});
const historical = buildDashboardHistoryModel({
  meta: metaRows[0],
  yearlyRevenueRows,
  categoryRows,
  clientRows: topClientRows,
});
const historicalCashInflow = buildHistoricalCashInflowContext({
  meta: metaRows[0],
  yearlyCashInflowRows,
});

const todayIso = todayISODate();
const pendingPayments = payments.filter(
  (payment) => payment.status !== "ricevuto" && payment.payment_type !== "rimborso",
);
const openTasks = clientTasks.filter((task) => task.done_date == null);
const deadlineTracker = buildDashboardDeadlineTrackerComputed({
  limitDateIso: addDaysToISODate(todayIso, 7),
  openTasks,
  pendingPayments,
  todayIso,
  unansweredQuotesCount: annual.alerts.unansweredQuotes.length,
  upcomingServicesCount: annual.alerts.upcomingServices.length,
});

console.log(
  JSON.stringify(
    {
      annual: {
        meta: annual.meta,
        kpis: annual.kpis,
        fiscalKpis: annual.fiscal?.fiscalKpis ?? null,
        fiscalDeadlines: annual.fiscal?.deadlines ?? [],
        businessHealth: annual.fiscal?.businessHealth ?? null,
        topClients: annual.topClients,
        quotePipeline: annual.quotePipeline.filter((x) => x.count > 0),
        deadlineTracker,
      },
      historical: {
        meta: historical.meta,
        kpis: historical.kpis,
        yearlyRevenue: historical.yearlyRevenue,
        topClients: historical.topClients.slice(0, 5),
      },
      historicalCashInflow,
    },
    null,
    2,
  ),
);
TS
```

## Confronti minimi da chiudere

### Annuale

Confrontare almeno:

- `Quanto ti resta in tasca`
- `Da incassare`
- `Lavoro del mese`
- `Lavoro dell'anno`
- `Preventivi aperti`
- `Prossimi 30 giorni`
- `Cosa devi fare`
- `Clienti principali`
- `Simulazione fiscale & salute aziendale`

### Storico

Confrontare almeno:

- `Lavoro totale`
- `Anno migliore`
- `Ultimo anno`
- `Crescita`
- `Clienti piu importanti finora`
- `Incassi ricevuti`

## Cleanup finale

Chiudere browser e pulire l'utente smoke.

```bash
agent-browser --session-name gestionale-bacheca close
cd /Users/rosariofurnari/Documents/gestionale-rosario
node scripts/auth-smoke-user.mjs cleanup --target remote --user-id <SMOKE_USER_ID>
```

## Artefatti consigliati

Salvare sempre:

- screenshot annuale top o full
- screenshot storico full
- `body` annuale
- `body` storico
- JSON del rebuild TypeScript

Percorsi usati nella verifica del 2026-04-01 / 2026-04-02:

- `/tmp/gestionale-bacheca-shots/`
- `/tmp/gestionale-bacheca-verify/`

## Nota pratica

Se in futuro cambia il wiring della bacheca:

- annuale -> aggiornare il check se cambia `buildDashboardModel`
- storico -> aggiornare il check se cambiano le view `analytics_*`
- card incassi storici -> aggiornare il check se cambia `buildHistoricalCashInflowContext`
- card deadline tracker -> aggiornare il check se cambiano i filtri su `payments` o `client_tasks`
