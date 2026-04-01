# Critical Triggers — Non Violabili

Questi trigger proteggono da errori ad alto costo. Sono estratti da
`.claude/learning.md` e promossi qui perche' questo file e' auto-loaded
in ogni sessione.

L'archivio completo dei trigger resta in `.claude/learning.md`.

---

## DOM-1: Fiscale = CASSA, non competenza

**Quando**: calcolo base imponibile forfettaria
**Fare**: verificare che usi `payments` (status=ricevuto, payment_date), NON
`services` (service_date)
**Perche'**: regime forfettario = principio di cassa (Art. 1 commi 54-89,
L. 190/2014)

## DOM-2: Forfettario != regime ordinario

**Quando**: propongo feature fiscali (deducibilita', IVA, costi deducibili)
**Fare**: FERMARMI e verificare se ha senso nel forfettario
**Perche'**: nel forfettario le spese NON si deducono individualmente — il
coefficiente di redditivita' le assorbe. No IVA, no deduzioni singole.

## BE-2: Nuova Edge Function -> config.toml!

**Quando**: creo una NUOVA Edge Function
**Fare**: aggiungere IMMEDIATAMENTE in `supabase/config.toml`:
`[functions.nome_funzione]` con `verify_jwt = false`
**Perche'**: l'auth e' gestita internamente da `_shared/authentication.ts`.
Senza la entry, Kong blocca il JWT → 401 sistematico su OGNI chiamata.
**Verifica**: `grep "functions.nome_funzione" supabase/config.toml`

## UI-7: Desktop props -> verificare SEMPRE il mobile

**Quando**: passo nuovi props a un componente condiviso
**Fare**: cercare TUTTE le chiamate nel codebase e verificare che i nuovi
props siano passati anche da `MobileDashboard` e qualsiasi altro consumer
**Perche'**: dati finanziari errati su mobile = rischio critico
**Verifica**: `grep -r "ComponentName" src/ --include="*.tsx"`

## WF-8: Business date = dateTimezone helper

**Quando**: scrivo `new Date().toISOString().slice(0,10)` o
`new Date("YYYY-MM-DD")` per date di business
**Fare**: usare `todayISODate()` o `toISODate(date)` da `dateTimezone`
(`src/lib/dateTimezone.ts` client, `_shared/dateTimezone.ts` EF)
**Perche'**: `toISOString()` converte in UTC prima di estrarre — data
sbagliata tra 00:00 e 02:00 CEST

## DB-1: Enum/Choice = aggiorna TUTTE le superfici

**Quando**: aggiungo un valore a un enum (expense_type, service_type, status)
**Fare**: aggiornare CHECK constraint DB, types.ts, UI choices/labels, views
con CASE, AI registry, Edge Functions, test
**Perche'**: un disallineamento blocca gli INSERT o mostra tipi senza label
**Verifica**: cercare il campo in tutti e 7 i punti prima di committare

## BE-1: Edge Function modificata -> deploy manuale

**Quando**: tocco codice in `supabase/functions/`
**Fare**: `git push` NON basta, serve `npx supabase functions deploy`
**Perche'**: altrimenti resta la vecchia versione in produzione

## WF-6: Commit codice -> docs+memoria NELLO STESSO commit

**Quando**: sto per eseguire `git commit` su codice prodotto
**Fare**: verificare se servono aggiornamenti a `docs/`, `memory/*.md`,
`.claude/learning.md`. Se si', includerli nello STESSO `git add` + `git commit`
**Perche'**: commit separati per docs causano disallineamenti sistematici
