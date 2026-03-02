# Progress — Gestionale Rosario Furnari

**Stato del documento:** `historical`
**Scopo:** log cronologico delle sessioni e delle decisioni utili per audit,
recupero profondo e ricostruzione della sequenza implementativa.
**Quando usarlo:** solo dopo aver letto `docs/README.md` e i documenti
`canonical`, oppure quando serve ricostruire una decisione o una data
specifica.
**Quando NON usarlo:** non come fonte primaria dello stato attuale del
prodotto e non come reading order iniziale di una nuova chat.
**File/moduli correlati:** `docs/README.md`,
`docs/development-continuity-map.md`,
`docs/historical-analytics-handoff.md`, `learnings.md`

## How To Use This File

- partire da `docs/README.md`, non da qui
- usare questo file come archivio cronologico, non come specifica corrente
- cercare per data, feature o keyword con `rg` invece di leggerlo tutto in
  sequenza
- se emerge una regola ancora viva, promuoverla nei documenti `canonical` o in
  `.claude/rules/`, non duplicarla qui come fonte primaria

## Quick Access

- temi recenti ad alto valore da cercare:
  - `launcher`
  - `contacts`
  - `billing`
  - `invoice`
  - `continuity`
  - `mobile`
- sessioni recenti piu' utili:
  - `Sessione 88` -> handoff launcher per servizi/spese non TV
  - `Sessione 87` -> handoff launcher verso `quick episode`
  - `Sessione 81-84` -> continuity chat, questioni lunghe, history, UX
  - `Sessione 77` -> mobile UX trasversale
  - `Sessione 54-57` -> nascita launcher, import fatture, read-context, answer
- ricerca consigliata:
  - `rg -n "launcher|invoice|contacts|billing|continuity|mobile" progress.md`

## Archive Rule

- tenere qui solo:
  - cronologia
  - milestone
  - verifiche runtime/manuali
  - decisioni che serve ricostruire nel tempo
- non trasformare `Current Phase` in un mega-riassunto cumulativo
- se una regola diventa stabile:
  - promuoverla nei docs `canonical` o in `.claude/rules/`
- se il file continua a crescere senza migliorare la ricerca:
  - preferire un futuro split per periodo o macro-fase, lasciando qui un indice
    breve

## Current Phase

- baseline stabile:
  - dashboard `Annuale` e `Storico` operative
  - AI guidata storica e annuale gia' chiusa sui contesti approvati
  - backbone commerciale minimo `quote -> project -> payment` stabile
- shell AI unificata:
  - launcher globale presente
  - snapshot CRM read-only presente
  - answer flow read-only presente
  - handoff verso superfici approvate presente
  - import fatture/ricevute presente con conferma esplicita
- baseline locale reale:
  - `make start` e `npx supabase db reset` ricostruiscono il dominio locale da
    `Fatture/`
  - il caso Diego/Gustare viene arricchito da
    `Fatture/contabilità interna - diego caltabiano/`
  - admin locale tecnico e smoke browser si appoggiano a quel dataset, non a
    fixture dominio hardcoded
  - il rebuild locale popola anche una foundation finanziaria esplicita:
    `financial_documents`, `cash_movements` e allocazioni
  - `project_financials` e' il primo consumer riallineato:
    foundation prima, legacy `payments` solo come fallback per progetti non
    ancora coperti
  - nuovo export fiscale 2025 integrato:
    - `FPR 1/25` e `FPR 2/25` ora arrivano da XML reali, non piu' solo dalla
      contabilita' interna
    - il trio `FPA 1/25` / `FPA 2/25` / `FPA 3/25` ha rivelato un caso reale
      `fattura -> TD04 -> riemissione`
    - la foundation ora conserva anche `xml_document_code`,
      `taxable_amount`, `tax_amount`, `stamp_amount`
    - lo stato incasso canonico del progetto resta quello di `payments.status`
      (`ricevuto / in_attesa / scaduto`)
- foundation condivise chiuse:
  - `crmSemanticRegistry`
  - `crmCapabilityRegistry`
  - communication layer `Gmail` outbound + `CallMeBot` interno prioritario
- anagrafica clienti:
  - profilo fiscale/fatturazione introdotto
  - referenti `contacts` riattivati e collegati a clienti/progetti
- linea di fase:
  - tenere stabile il perimetro chiuso
  - non aggiungere AI sparse
  - non trattare i test come priorita' prima del sistema
  - usare il rebuild reale per far emergere gap su pagato/non pagato,
    referenti, lavori e allocazioni
  - priorita' aperta: separare meglio documento, aperto e cassa
  - solo dopo valutare fornitori come slice separata

## Last Session

### Sessione 78 (2026-03-01, spostamento km nel launcher unificato)

- Completed:
  - **La chat unificata ora copre un use case reale di trasferta km**:
    - nessuna nuova AI sparsa
    - stesso launcher unificato
    - se la domanda descrive chiaramente una tratta da registrare come spesa,
      il flow passa su un ramo deterministico invece di far stimare i km al
      modello testuale
  - **Integrato `openrouteservice` nel corridoio launcher -> spesa km**:
    - parsing origine/destinazione e round-trip dalla domanda
    - geocoding ORS
    - routing ORS
    - derivazione km e rimborso stimato con `km_rate` condiviso del CRM
  - **Chiusa la superficie approvata di atterraggio**:
    - `expenses/create` legge ora prefills da query string
    - il form puo aprirsi gia con `spostamento_km`, data, km, tariffa e
      descrizione tratta
    - compare un banner launcher coerente prima del salvataggio
  - **Allineati registry, test e continuita'**:
    - semantic registry
    - capability registry
    - test backend helper
    - test expense linking
    - docs di continuita'

- Risks / notes:
  - se la tratta usa solo nomi citta'/localita', il geocoding puo risolvere un
    punto generico e non l'indirizzo preciso
  - per questo i km restano sempre correggibili sul form `Spese`
  - il secret ORS va ancora allineato anche nel runtime edge remoto quando
    porteremo questo flow fuori dal solo ambiente locale

- Validation:
  - `npm run typecheck`
  - `npm test -- --run supabase/functions/_shared/unifiedCrmAnswer.test.ts src/components/atomic-crm/expenses/expenseLinking.test.ts src/lib/semantics/crmCapabilityRegistry.test.ts src/lib/semantics/crmSemanticRegistry.test.ts`
  - chiamate ORS reali locali su:
    - geocoding `Valguarnera Caropepe, Enna, Italy`
    - geocoding `Catania, Italy`
    - routing `Valguarnera Caropepe -> Catania`

### Sessione 77 (2026-03-01, mobile UX overhaul + login/signup fix)

- Completed:
  - **Mobile UX completa su tutti i moduli CRUD** (Pagamenti, Spese, Clienti,
    Progetti, Servizi):
    - Card-based list view su mobile (no tabelle cramped)
    - Sheet-based mobile filter (drawer dal basso) con contatore filtri attivi
    - MobileBackButton su tutte le pagine Show/Edit/Create
    - FormToolbar con `pb-20 md:pb-0` per non nascondersi dietro la nav bar
    - TopToolbar centrata su mobile
    - Spacing uniforme `mt-4` su tutte le pagine (List, Show, Edit, Create)
  - **Rimosso MobileHeader** da Dashboard e Tasks (troppo ingombrante)
  - **MobileContent** semplificato: `pt-4` (era `pt-18`)
  - **Login page**: aggiunta foto utente con maschera circolare sopra "Accedi"
  - **Signup page**: rimossa scritta titolo, aggiunta foto utente con maschera
    circolare, usata immagine `/android-chrome-512x512.png`
  - **Auth fix**: `getIsInitialized()` ora ritorna sempre `true` (app single-user,
    account gia esistente sul remoto). Eliminato il bug che dopo clear cache del
    browser mostrava il signup invece del login.

- Risks / notes:
  - Il pattern mobile filter (Sheet) e' replicato in 5 moduli — se cambia la
    struttura va toccato ovunque
  - `getIsInitialized` hardcoded a `true` significa che la signup page non
    apparira mai piu — corretto per single-user, da rivedere se il progetto
    diventa multi-user

- Validation:
  - `npm run typecheck` — 0 errori
  - Verifica visiva su iPhone 12 Pro (screenshot reali utente)

### Sessione 76 (2026-03-01, verifica reale chat launcher e fix crash spese)

- Completed:
  - **Confermata in browser reale la chiusura dei regressi UX del composer
    launcher**:
    - il full-screen writer non mostra piu copy inutile
    - il full-screen writer non cade piu nel layout spezzato visto negli
      screenshot regressivi
    - il comportamento del composer con spazi, soglie icona e scrollbar e'
      rientrato nel comportamento atteso
  - **Chiuso un crash reale sulla lista `Spese`**:
    - `ExpenseListActions` usava `exporter` senza riceverlo come prop
    - ora `List` e `ExportButton` condividono lo stesso exporter locale
    - `/#/expenses` non va piu in errore con `exporter is not defined`

### Sessione 81 (2026-03-01, fix scroll chat launcher su iPhone)

- Completed:
  - **Chiuso un regress reale di scroll nel launcher chat su mobile**:
    - da screenshot utente su iPhone Safari il drawer apriva correttamente ma
      il corpo della conversazione non riusciva piu a scrollare dopo una
      risposta lunga
    - il launcher ora forza una chain di layout compatibile con nested scroll
      mobile:
      - `SheetContent` con `min-h-0` e `overflow-hidden`
      - wrapper chat con `min-h-0`
      - area messaggi dedicata con `overflow-y-auto`,
        `webkit-overflow-scrolling: touch` e `touch-action: pan-y`
      - composer marcato `shrink-0` per non mangiare l'overflow del body
- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/ai/UnifiedAiLauncher.test.tsx`

- Risks / notes:
  - la verifica chat ora e' chiusa sul browser locale che ha mostrato il bug
  - resta comunque utile uno smoke piu ampio su altri device/browser quando
    toccheremo ancora il composer

- Validation:
  - `npm run typecheck` sul fix `Spese`
  - verifica manuale reale utente su chat launcher e `/#/expenses`

### Sessione 75 (2026-03-01, cleanup editor esteso composer launcher)

- Completed:
  - **Tolto il copy inutile dall'editor esteso della chat**:
    - nessun titolo descrittivo visibile
    - nessun testo di supporto sotto il campo
    - restano solo area di scrittura, chiusura e invio
  - **Corretto il layout del full-screen writer**:
    - il dialog usa davvero una colonna verticale pulita
    - non ricade piu in una disposizione spezzata che ruba spazio al testo
  - **Rimesso sotto controllo il sizing dei textarea del composer**:
    - i campi della chat launcher ora usano `field-sizing-fixed`
    - le soglie prodotto restano governate dalla logica esplicita del
      composer, anche su input composti quasi solo da spazi

- Risks / notes:
  - il fine-tuning delle soglie resta comunque dipendente dal `line-height`
    reale del browser
  - non ho ancora chiuso smoke reale su device mobile

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/ai/UnifiedAiLauncher.test.tsx`

### Sessione 74 (2026-03-01, persistenza chat launcher e drawer mobile full-screen)

- Completed:
  - **La chat del launcher ora sopravvive a close/reopen**:
    - ultima risposta CRM preservata
    - bozza pagamento collegata preservata
    - testo domanda non ancora inviata preservato
    - il reset automatico alla chiusura non tocca piu la conversazione chat
  - **Il reset resta confinato al workflow documentale**:
    - file selezionati import fatture
    - bozza import generata
    - stato conferma import
    continuano a resettarsi alla chiusura del drawer
  - **Su mobile il launcher ora usa tutta l'altezza disponibile**:
    - niente piu `88vh`
    - drawer full-screen fino al bordo alto
  - **Il composer della chat ora ha soglie UX esplicite per testi lunghi**:
    - dalla terza riga compare l'icona per aprire l'editor esteso
    - dalla settima riga compare la scrollbar locale nel composer compatto
    - l'editor esteso continua a modificare la stessa domanda, non una copia
    - anche i ritorni a capo automatici del testo lungo contano per quelle
      soglie, non solo gli `Invio` manuali

- Risks / notes:
  - riaprendo il launcher l'ultima risposta puo riferirsi a una snapshot CRM
    non piu freschissima; il timestamp visibile resta il boundary esplicito
  - le soglie del composer dipendono dalla misura runtime del `line-height`,
    quindi il fine-tuning reale va confermato su browser/device veri
  - non ho ancora fatto smoke browser mobile reale su device, solo validazione
    locale e test UI

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/ai/UnifiedAiLauncher.test.tsx src/lib/semantics/crmCapabilityRegistry.test.ts`

### Sessione 73 (2026-03-01, continuita' billing profile su chat e lista clienti)

- Completed:
  - **Allineata la snapshot CRM-wide del launcher ai nuovi campi fiscali
    cliente**:
    - `recentClients` ora espone denominazione fatturazione, `P.IVA`, `CF`,
      `Codice Destinatario`, `PEC` e indirizzo fiscale riassunto
    - le referenze cliente collegate a preventivi, progetti e pagamenti
      riusano il nome piu coerente con la fatturazione quando disponibile
  - **Allineata anche la discovery clienti nel CRM**:
    - la lista mostra badge fiscali e anagrafica di fatturazione sintetica
    - i filtri supportano `billing_name`, `vat_number`, `fiscal_code`,
      `billing_sdi_code`, `billing_pec` e `billing_city`
  - **Riallineati semantica e capability registry**:
    - il contesto read-only del launcher dichiara ora anche recapiti di
      fatturazione principali, non solo il profilo fiscale essenziale

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/lib/ai/unifiedCrmReadContext.test.ts src/components/atomic-crm/ai/UnifiedAiLauncher.test.tsx src/components/atomic-crm/clients/clientListFilters.test.ts src/lib/semantics/crmCapabilityRegistry.test.ts src/lib/semantics/crmSemanticRegistry.test.ts`

### Sessione 72 (2026-03-01, foundation anagrafica cliente fiscale)

- Completed:
  - **Chiusa la foundation anagrafica cliente da fatturazione nel CRM**:
    - migration `20260301153000_add_client_billing_profile.sql`
    - nuovi campi strutturati per denominazione, P.IVA, CF, indirizzo fiscale,
      codice destinatario e PEC
    - `ClientCreate`, `ClientInputs`, `ClientShow`, export clienti e `QuotePDF`
      riallineati nello stesso passaggio
  - **Chiusa la continuita' dei campi fiscali nel workflow import fatture**:
    - schema Gemini e parser aggiornati
    - prompt edge function aggiornato
    - draft editor aggiornato con campi modificabili
    - se il cliente manca, il draft apre `clients/create` gia precompilato
  - **Chiuso anche il fallback di tracciabilita'**:
    - se l'utente conferma direttamente `payments` / `expenses`, i dati fiscali
      letti restano nelle note del record creato invece di perdersi

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/lib/ai/invoiceImport.test.ts src/lib/ai/invoiceImportProvider.test.ts supabase/functions/_shared/invoiceImportExtract.test.ts src/components/atomic-crm/clients/clientBilling.test.ts src/components/atomic-crm/clients/clientLinking.test.ts src/lib/semantics/crmSemanticRegistry.test.ts src/lib/semantics/crmCapabilityRegistry.test.ts src/components/atomic-crm/ai/UnifiedAiLauncher.test.tsx`
  - `npx supabase db push --linked --include-all --yes`
  - `npx supabase functions deploy invoice_import_extract --project-ref qvdmzhyzpyaveniirsmo`
  - smoke remoto autenticato su PDF reale `FPR 1/23`:
    - `billingName = LAURUS S.R.L.`
    - `vatNumber = IT04126560871`
    - `billingCity = Pozzallo`
    - `billingSdiCode = M5UXCR1`
    - warning coerente su cliente mancante nel CRM

### Sessione 71 (2026-03-01, analisi anagrafica cliente da fatturazione)

- Completed:
  - **Chiusa l'analisi del slice `anagrafica cliente da fatturazione/import
    storico`**:
    - verificati schema `clients`, UI cliente e contratto attuale
      dell'import fatture
    - ispezionate fatture XML reali in `Fatture/2023`, `Fatture/2024`,
      `Fatture/2025`
    - fissato il perimetro del prossimo intervento prima di toccare il DB
  - **Definito il minimo profilo fiscale cliente che ricorre davvero nelle
    fatture reali**:
    - `Denominazione`
    - `IdPaese`
    - `IdCodice`
    - `CodiceFiscale`
    - `Indirizzo`
    - `NumeroCivico`
    - `CAP`
    - `Comune`
    - `Provincia`
    - `Nazione`
    - `CodiceDestinatario`
  - **Confermato il confine col tema fornitori**:
    - il problema fornitori e' reale
    - oggi `expenses` usa ancora `client_id`
    - ma la pagina/risorsa fornitori resta uno slice separato da affrontare
      dopo

- Validation:
  - lettura strutturata dello schema locale
  - ispezione manuale di fatture XML reali in repo
  - continuita' aggiornata in `handoff`, `backlog`, `progress`, `learnings`

### Sessione 70 (2026-03-01, project quick-payment draft nel launcher)

- Completed:
  - **Il launcher supporta ora un secondo write-draft stretto sul percorso
    `project -> quick payment`**:
    - la chat puo proporre una bozza pagamento project-driven
    - la bozza resta modificabile nel launcher
    - la conferma resta nel dialog approvato del progetto
  - **La snapshot CRM read-only ora include financials minimi del progetto
    attivo**:
    - `totalFees`
    - `totalExpenses`
    - `totalPaid`
    - `balanceDue`
    - questi valori sono derivati deterministicamente da servizi, spese e
      pagamenti ricevuti
  - **Il quick payment di progetto consuma la bozza senza aprire write
    generale**:
    - il deep-link porta `payment_type`, `amount` e `status`
    - `QuickPaymentDialog` si apre con quei valori precompilati
    - il dialog resta manuale e confermato solo dall'utente

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/lib/ai/unifiedCrmReadContext.test.ts src/components/atomic-crm/payments/paymentLinking.test.ts supabase/functions/_shared/unifiedCrmAnswer.test.ts src/components/atomic-crm/ai/UnifiedAiLauncher.test.tsx`

- Decisions:
  - il secondo write-draft era legittimo solo riusando una superficie gia
    approvata con financials locali deterministici
  - oltre questo punto non apro altri casi write-assisted per default nella
    stessa fase
  - la chat generale resta senza write execution diretta
### Sessione 69 (2026-03-01, redesign UX del launcher AI)

- Completed:
  - **Il launcher AI ora apre sulla chat come vista primaria**:
    - `Chat AI` e' la vista default
    - `Snapshot CRM` e `Importa fatture e ricevute` non stanno piu nello stesso scroll
      infinito
    - le viste secondarie si aprono dal bottone `+`
    - il bottone `+` vive nel composer, a sinistra del campo di scrittura
  - **La shell e' stata separata in viste chiare senza rompere la logica
    esistente**:
    - nuovo header a viste
    - answer panel alleggerito e compattato
    - import fatture estratto in vista dedicata
    - `PaymentDraftCard` estratta dal pannello chat
  - **La vista chat ora segue un layout conversazionale standard**:
    - messaggi, draft e handoff stanno sopra
    - il composer resta in basso nel pannello
    - i suggerimenti rapidi vivono insieme al composer, non sopra tutta la chat
    - il menu delle viste secondarie vive dentro il composer invece che
      nell'header del drawer
  - **La chat conserva il proprio stato mentre navighi nelle altre viste del
    launcher**:
    - il pannello chat resta montato
    - snapshot/import non invadono piu il percorso principale

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/ai/UnifiedAiLauncher.test.tsx`

- Decisions:
  - per una shell AI unificata, la chat deve essere la vista primaria e le
    utility secondarie devono stare dietro navigazione esplicita
  - il redesign UX del launcher puo essere fatto come slice tattico, senza
    cambiare il perimetro funzionale o semantico approvato

### Sessione 68 (2026-03-01, stop auto-refill after first manual amount edit)

- Completed:
  - **Il form `payments/create` smette di riprendersi il controllo
    dell'importo dopo il primo edit manuale**:
    - una volta che l'utente tocca `amount`:
      - il suggerimento automatico non rientra piu da solo
      - svuotare temporaneamente il campo per digitare un nuovo importo non
        causa piu il refill automatico del residuo
  - **Il suggerimento locale resta disponibile ma solo come scelta esplicita**:
    - il CTA `Usa <importo suggerito>` resta disponibile
    - l'automatismo pero' si ferma quando l'utente prende il controllo del
      campo
  - **Semantica e capability registrano anche questa ownership del campo
    importo**:
    - dopo il primo edit manuale il form non deve piu ricalcolare il valore in
      automatico

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/payments/paymentLinking.test.ts src/lib/semantics/crmCapabilityRegistry.test.ts src/lib/semantics/crmSemanticRegistry.test.ts`

- Decisions:
  - in un workflow assistito, i suggerimenti automatici devono cedere il passo
    al primo segnale di edit manuale reale
  - il controllo del campo importo deve passare in modo stabile all'utente fino
    a una scelta esplicita di riapplicare il suggerimento

### Sessione 67 (2026-03-01, segnalazione esplicita quando la bozza non vale piu)

- Completed:
  - **Il form `payments/create` ora segnala esplicitamente quando la bozza AI
    iniziale non e' piu valida**:
    - se l'utente cambia preventivo rispetto a quello della bozza:
      - il vecchio importo draft non resta attivo
      - compare un messaggio chiaro che spiega che da quel punto vale solo il
        contesto locale del preventivo selezionato
  - **Il corridoio launcher -> form approvato diventa piu comprensibile oltre
    che corretto**:
    - prima il comportamento corretto c'era, ma era implicito
    - ora la UI rende esplicita la fine del contesto draft
  - **Registry e semantica allineati anche sul requisito di segnalazione**:
    - `prepare_payment_write_draft` dichiara che la superficie approvata deve
      segnalare quando il contesto draft non vale piu
    - `unifiedAiWriteDraft` esplicita il ritorno alla semantica locale del form

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/payments/paymentLinking.test.ts src/lib/semantics/crmCapabilityRegistry.test.ts src/lib/semantics/crmSemanticRegistry.test.ts`

- Decisions:
  - in un workflow write-assisted non basta fare la cosa giusta: quando il
    contesto AI decade, la UI deve anche dirlo chiaramente
  - la continuita' forte richiede sia correttezza semantica sia feedback
    esplicito all'utente

### Sessione 66 (2026-03-01, scope del draft solo sullo stesso preventivo)

- Completed:
  - **Il draft importato dal launcher non resta piu attivo se il form cambia
    preventivo**:
    - la preservazione dell'importo draft vale solo finche `payments/create`
      resta sullo stesso `quote_id` della bozza
    - se l'utente cambia preventivo:
      - il vecchio importo draft smette di essere privilegiato
      - il suggerimento locale del nuovo preventivo puo riprendere
  - **La UI evita un contesto fuorviante sulla superficie approvata**:
    - il riepilogo "Importo arrivato dalla bozza AI" compare solo quando il
      preventivo corrente coincide con quello della bozza
    - non viene piu mostrato come se appartenesse a un altro preventivo scelto
      dopo
  - **Semantica e capability registrano anche questo vincolo di contesto**:
    - la preservazione degli edit del launcher vale solo sullo stesso
      preventivo della bozza

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/payments/paymentLinking.test.ts src/lib/semantics/crmCapabilityRegistry.test.ts src/lib/semantics/crmSemanticRegistry.test.ts`

- Decisions:
  - un draft write-assisted resta valido solo finche il contesto business che
    lo ha generato non cambia
  - quando il contesto cambia, e' meglio tornare subito alla semantica locale
    della superficie approvata invece di trascinare metadati del launcher

### Sessione 65 (2026-03-01, preserve draft amount on payments/create)

- Completed:
  - **Il form `payments/create` non sovrascrive piu l'importo corretto nel
    launcher**:
    - se la bozza AI arriva con un importo esplicito modificato dall'utente:
      - il primo render del form lo preserva
      - il suggerimento locale del residuo non lo rimpiazza in automatico
  - **La superficie approvata distingue chiaramente tra bozza AI e suggerimento
    locale**:
    - il contesto preventivo ora puo mostrare insieme:
      - importo arrivato dalla bozza AI
      - residuo locale del preventivo
    - se i due valori differiscono:
      - l'utente vede la differenza
      - puo scegliere esplicitamente se usare il residuo locale
  - **Semantica e capability allineate anche su questo comportamento di
    preservazione**:
    - `prepare_payment_write_draft` dichiara che la superficie di arrivo deve
      preservare gli edit espliciti del launcher
    - `unifiedAiWriteDraft` esplicita che il suggerimento residuo resta solo
      un'alternativa locale, non un override silenzioso

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/payments/paymentLinking.test.ts src/lib/semantics/crmCapabilityRegistry.test.ts src/lib/semantics/crmSemanticRegistry.test.ts`

- Decisions:
  - se una bozza write-assisted attraversa due superfici, la superficie finale
    non deve cancellare gli edit espliciti gia fatti dall'utente nella prima
  - i suggerimenti deterministici locali restano utili, ma solo come scelta
    esplicita e non come override implicito

### Sessione 64 (2026-03-01, first narrow payment write-draft nel launcher)

- Completed:
  - **Il launcher puo ora proporre una bozza pagamento stretta, modificabile e
    separata dal markdown della risposta**:
    - il payload `paymentDraft` compare solo quando:
      - la domanda chiede davvero di preparare/registrare/creare un pagamento
      - esiste un preventivo aperto con stato compatibile
      - esiste ancora un residuo positivo deterministicamente calcolabile
    - la bozza contiene:
      - `paymentType`
      - `amount`
      - `status`
      - riferimenti `quote/client/project`
  - **La bozza non scrive dal launcher e usa solo la superficie gia approvata**:
    - il pannello chat lascia modificare:
      - tipo pagamento
      - importo
      - stato
    - il CTA finale apre `/#/payments/create?...&draft_kind=payment_create`
    - la scrittura reale parte solo dal form pagamenti con conferma esplicita
  - **La base semantica e' stata aggiornata nello stesso passaggio**:
    - capability registry:
      - nuova action `prepare_payment_write_draft`
    - semantic registry:
      - nuova regola `unifiedAiWriteDraft`
    - read context:
      - gli open quote espongono anche linked total e residual amount

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/lib/ai/unifiedCrmReadContext.test.ts src/components/atomic-crm/payments/paymentLinking.test.ts src/components/atomic-crm/ai/UnifiedAiLauncher.test.tsx src/lib/semantics/crmCapabilityRegistry.test.ts src/lib/semantics/crmSemanticRegistry.test.ts supabase/functions/_shared/unifiedCrmAnswer.test.ts`
  - `npx supabase functions deploy unified_crm_answer --project-ref qvdmzhyzpyaveniirsmo --no-verify-jwt`
  - smoke remoto autenticato con domanda:
    - `Preparami una bozza saldo dal preventivo aperto.`

- Decisions:
  - il primo write-draft della chat generale deve restare strettissimo,
    deterministico e separato dal testo markdown della risposta
  - la chat puo preparare il draft, ma la conferma resta sulla superficie CRM
    approvata di destinazione
  - l'estensione di questo pattern ad altri casi va fatta solo se la semantica
    resta altrettanto forte

### Sessione 63 (2026-03-01, suggerimento importo sul landing quote -> payment)

- Completed:
  - **Il form `payments/create` ora usa davvero il contesto del preventivo
    collegato**:
    - mostra:
      - importo preventivo
      - totale gia collegato
      - residuo ancora non collegato
    - espone un CTA esplicito:
      - `Usa <importo suggerito>`
  - **Il suggerimento importo resta deterministicamente locale alla superficie
    di arrivo**:
    - per `acconto` / `saldo` / `parziale` suggerisce il residuo non ancora
      collegato
    - per `rimborso` / `rimborso_spese` non suggerisce importi automatici
    - se l'utente ha gia toccato manualmente il campo importo, il sistema non
      lo sovrascrive
  - **Semantica e capability riallineate nello stesso passaggio**:
    - `quote_create_payment` ora dichiara anche il suggerimento residuo
    - il registry semantico esplicita che la superficie di arrivo puo
      calcolare solo suggerimenti locali deterministici

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/payments/paymentLinking.test.ts src/lib/semantics/crmCapabilityRegistry.test.ts src/lib/semantics/crmSemanticRegistry.test.ts`

- Decisions:
  - i suggerimenti importo sul landing commerciale devono nascere dai dati gia
    caricati dalla superficie di arrivo, non dal modello
  - `rimborso` e `rimborso_spese` restano fuori da questo auto-suggest per non
    confondere il significato del residuo preventivo
  - il caso `cliente mancante da fattura storica` resta differito rispetto a
    questo percorso prioritario

### Sessione 62 (2026-03-01, landing contestuale sulle superfici commerciali approvate)

- Completed:
  - **I handoff del launcher non si limitano piu a una route: ora atterrano
    con contesto e prefills gia supportati dalla UI reale**:
    - `payments/create` puo ricevere da launcher:
      - `quote_id`
      - `client_id`
      - `project_id`
      - `payment_type`
      - metadata `launcher_*`
    - `project_quick_payment` puo aprire:
      - `ProjectShow`
      - con `open_dialog=quick_payment`
      - e `payment_type` quando esplicito nella domanda
  - **Le superfici di arrivo consumano il contesto senza eseguire nulla in automatico**:
    - `PaymentCreate` mostra un banner launcher e rispetta i prefills gia supportati
    - `ProjectShow` mostra il banner launcher
    - `QuickPaymentDialog` si autoapre solo dal deep-link approvato e solo
      quando i financials sono disponibili
  - **L'euristica di handoff evita di mandare al posto sbagliato quando la
    domanda parla di saldo dal progetto**:
    - se la domanda e' orientata a registrare un pagamento sul progetto e non
      esiste un pending payment dominante:
      - prevale `project_quick_payment`

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/ai/UnifiedAiLauncher.test.tsx src/components/atomic-crm/payments/paymentLinking.test.ts src/lib/semantics/crmCapabilityRegistry.test.ts src/lib/semantics/crmSemanticRegistry.test.ts supabase/functions/_shared/unifiedCrmAnswer.test.ts`
  - `npx supabase functions deploy unified_crm_answer --project-ref qvdmzhyzpyaveniirsmo --no-verify-jwt`
  - smoke autenticato remoto riuscito su `unified_crm_answer` con domanda
    `Come posso registrare il saldo del progetto attivo?` e ritorno reale di:
    - `project_quick_payment` come prima action
    - `recommended = true`
    - href con `launcher_source`, `launcher_action`, `open_dialog=quick_payment`
    - `payment_type=saldo`

- Decisions:
  - gli handoff del launcher possono trasportare solo prefills/search params
    gia supportati dalle superfici approvate
  - `project_quick_payment` puo autoaprire il dialog solo dal deep-link
    approvato e senza eseguire la registrazione
  - il caso `cliente mancante da fattura storica` resta differito rispetto a
    questo percorso prioritario

### Sessione 61 (2026-03-01, recommendation primaria sui handoff commerciali)

- Completed:
  - **Il launcher non si limita piu a ordinare i handoff: ora espone anche
    una recommendation primaria esplicita**:
    - una sola `suggestedAction` puo essere marcata come:
      - `recommended`
      - con `recommendationReason`
    - il pannello answer rende visibili:
      - badge `Consigliata ora`
      - motivo sintetico della scelta
  - **Le domande gia orientate a registrare un pagamento privilegiano il
    punto giusto gia approvato**:
    - se la domanda chiede di `registrare`/`aggiungere` un pagamento e il
      preventivo e' in stato coerente:
      - `quote_create_payment` sale in testa
    - il resto dei suggerimenti resta disponibile come fallback
  - **La recommendation resta deterministicamente costruita dal sistema**:
    - non viene chiesta al modello
    - usa solo:
      - intent della domanda
      - stato preventivo
      - record gia presenti nello snapshot

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/ai/UnifiedAiLauncher.test.tsx src/lib/semantics/crmCapabilityRegistry.test.ts src/lib/semantics/crmSemanticRegistry.test.ts supabase/functions/_shared/unifiedCrmAnswer.test.ts`
  - `npx supabase functions deploy unified_crm_answer --project-ref qvdmzhyzpyaveniirsmo --no-verify-jwt`
  - smoke autenticato remoto riuscito su `unified_crm_answer` con domanda
    `Da dove posso registrare un pagamento sul preventivo aperto?` e ritorno
    reale di:
    - `quote_create_payment` come prima action
    - `recommended = true`
    - `recommendationReason` deterministica

- Decisions:
  - se il launcher suggerisce piu handoff commerciali, solo uno puo essere
    promosso a recommendation primaria
  - la recommendation primaria deve restare costruita dal sistema, non dal
    modello
  - il caso `cliente mancante da fattura storica` resta fuori dal focus finche'
    non si chiude il percorso prioritario del launcher unificato

### Sessione 60 (2026-03-01, handoff commerciale orientato ad azioni approvate)

- Completed:
  - **Il launcher non suggerisce piu solo record o liste: ora propone anche il
    primo handoff commerciale orientato ad azioni reali**:
    - le `suggestedActions` possono ora rappresentare:
      - route show/list/page
      - azioni approvate come:
        - `quote_create_payment`
        - `client_create_payment`
        - `project_quick_payment`
    - il pannello answer rende visibile quando una suggestion e' una
      `Azione approvata`
  - **I handoff commerciali restano deterministicamente controllati**:
    - i form pagamento precompilati usano href costruiti dal sistema
    - i jump progetto per quick payment aprono il progetto corretto
    - nessuna URL commerciale viene inventata dal modello
  - **Feedback reale utente registrato senza spostare la priorita' corrente**:
    - backlog aggiornato sul caso:
      - fattura cliente storica con cliente assente dal CRM
      - campi anagrafici fatturazione ancora incompleti

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/ai/UnifiedAiLauncher.test.tsx src/lib/ai/unifiedCrmReadContext.test.ts src/lib/semantics/crmCapabilityRegistry.test.ts src/lib/semantics/crmSemanticRegistry.test.ts supabase/functions/_shared/unifiedCrmAnswer.test.ts`
  - `npx supabase functions deploy unified_crm_answer --project-ref qvdmzhyzpyaveniirsmo --no-verify-jwt`
  - smoke autenticato remoto riuscito su `unified_crm_answer` con domanda
    `Chi mi deve ancora pagare?` e ritorno reale di:
    - `payments show`
    - `quote_create_payment`
    - `project_quick_payment`

- Decisions:
  - il primo salto dalla chat verso il commerciale deve puntare a entry point
    gia approvati e non inventare workflow nuovi
  - il caso `cliente mancante da fattura storica` e' reale, ma resta differito
    finche' non si chiude il percorso prioritario del launcher unificato

### Sessione 59 (2026-03-01, handoff guidato da answer flow a route CRM)

- Completed:
  - **Le risposte del launcher ora accompagnano anche al punto giusto del CRM**:
    - `unified_crm_answer` ora restituisce anche:
      - `suggestedActions`
    - le azioni suggerite sono renderizzate dentro il pannello answer del
      launcher
    - click su una suggestion chiude la shell e porta alla route suggerita
  - **Handoff reso deterministicamente coerente col CRM**:
    - i link non sono generati dal modello
    - vengono costruiti da:
      - `routePrefix`
      - record id nello snapshot read-only
    - supportano:
      - dashboard
      - resource list
      - record show
  - **Registry e continuita' riallineati nello stesso passaggio**:
    - capability registry aggiornato con:
      - `follow_unified_crm_handoff`
    - semantic registry rafforzato sul fatto che gli handoff possono puntare
      solo a superfici gia approvate

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/ai/UnifiedAiLauncher.test.tsx src/lib/ai/unifiedCrmReadContext.test.ts src/lib/semantics/crmCapabilityRegistry.test.ts src/lib/semantics/crmSemanticRegistry.test.ts supabase/functions/_shared/unifiedCrmAnswer.test.ts`
  - `npx supabase functions deploy unified_crm_answer --project-ref qvdmzhyzpyaveniirsmo --no-verify-jwt`
  - smoke autenticato remoto riuscito su `unified_crm_answer` con domanda
    `Chi mi deve ancora pagare?` e ritorno reale di `suggestedActions`

- Decisions:
  - le route suggerite dal launcher vanno costruite deterministicamente dal
    sistema, non inventate dal modello
  - il primo handoff della chat generale resta su superfici esistenti
    `read-only` o comunque gia approvate, senza esecuzione diretta
  - il passo successivo chiuso sopra questo livello e' il primo handoff
    commerciale orientato ad azioni gia approvate, non un nuovo consumer AI
    separato

### Sessione 58 (2026-03-01, answer flow AI read-only nel launcher unificato)

- Completed:
  - **La chat unificata ora risponde anche sul CRM core, non solo sulle
    fatture**:
    - nuovo pannello:
      - `UnifiedCrmAnswerPanel`
    - nuove domande suggerite read-only sul CRM core
    - risposta markdown grounded dentro la stessa shell globale
  - **Provider, function e settings riallineati nello stesso passaggio**:
    - nuovo entry point provider:
      - `askUnifiedCrmQuestion(question, context)`
    - nuova Edge Function:
      - `unified_crm_answer`
    - `Impostazioni -> AI` ora dichiara che il modello testuale serve anche
      alle risposte read-only del launcher
  - **Boundary di scrittura reso esplicito nella base condivisa**:
    - semantic registry aggiornato sulla regola `unifiedAiReadContext`
    - capability registry aggiornato con:
      - azione `ask_unified_crm_question`
    - la policy `read-only first / write assistito con conferma poi` ora e'
      scritta anche nei docs di continuita'

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/ai/UnifiedAiLauncher.test.tsx src/lib/ai/unifiedCrmReadContext.test.ts src/lib/semantics/crmCapabilityRegistry.test.ts src/lib/semantics/crmSemanticRegistry.test.ts supabase/functions/_shared/unifiedCrmAnswer.test.ts`
  - `npm run registry:gen`
  - `npx supabase functions deploy unified_crm_answer --project-ref qvdmzhyzpyaveniirsmo --no-verify-jwt`
  - smoke autenticato remoto riuscito su `unified_crm_answer` con risposta
    `200` e answer markdown reale, poi cleanup utente smoke

- Decisions:
  - il general Q&A del launcher deve usare la stessa snapshot che l'utente vede
    in UI, non un contesto ricostruito diversamente lato function
  - la chat CRM generale resta read-only anche se l'obiettivo di lungo periodo
    include write assistito
  - il prossimo passo Pareto e' un handoff guidato verso azioni/route CRM gia
    esistenti, non l'esecuzione diretta di scritture dal Q&A generale

### Sessione 57 (2026-02-28, read context CRM-wide nel launcher unificato)

- Completed:
  - **Il launcher ora legge anche il CRM core, non solo le fatture**:
    - nuovo context builder:
      - `buildUnifiedCrmReadContext()`
    - nuovo provider entry point:
      - `getUnifiedCrmReadContext()`
    - snapshot read-only nello stesso launcher per:
      - `clients`
      - `quotes`
      - `projects`
      - `payments`
      - `expenses`
  - **Semantica e capability riallineate nello stesso passaggio**:
    - semantic registry aggiornato con:
      - regola `unifiedAiReadContext`
    - capability registry aggiornato con:
      - azione `read_unified_crm_context`
      - dialog launcher descritto anche come snapshot CRM core
  - **Launcher unificato esteso senza riaprire l’architettura**:
    - nessuna nuova route AI
    - nessuna nuova card AI di pagina
    - stesso bottone flottante, stessa shell, piu contesto condiviso

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/ai/UnifiedAiLauncher.test.tsx src/lib/ai/unifiedCrmReadContext.test.ts src/lib/semantics/crmCapabilityRegistry.test.ts src/lib/semantics/crmSemanticRegistry.test.ts`
  - `npm run registry:gen`

- Decisions:
  - il contesto CRM-wide va esposto da un solo provider entry point riusabile
    da UI e AI futura
  - il launcher deve diventare piu consapevole del CRM restando una superficie
    unica, non moltiplicando piccoli strumenti separati
  - il prossimo passo Pareto e' il primo answer flow AI read-only sopra questo
    contesto condiviso

### Sessione 56 (2026-02-28, vertical slice fatture mista chiusa e verificata)

- Completed:
  - **Primo workflow reale della chat AI unificata chiuso dentro il launcher**:
    - upload misto:
      - `PDF` digitali
      - scansioni/foto
    - estrazione strutturata via `@google/genai`
    - bozza modificabile direttamente nella stessa shell
    - conferma esplicita verso:
      - `payments`
      - `expenses`
  - **Provider, semantica e capability allineati nello stesso passaggio**:
    - nuovi entry point:
      - `getInvoiceImportWorkspace()`
      - `uploadInvoiceImportFiles()`
      - `generateInvoiceImportDraft()`
      - `confirmInvoiceImportDraft()`
    - registry semantico aggiornato con:
      - mapping fattura cliente -> `payments`
      - mapping fattura fornitore -> `expenses`
      - nessuna scrittura prima della conferma utente
    - capability registry aggiornato con:
      - azioni di estrazione e conferma import fatture
  - **Runtime remoto chiuso sul progetto collegato**:
    - secret:
      - `GEMINI_API_KEY`
    - function deployata:
      - `invoice_import_extract`
    - smoke autenticato riuscito con:
      - `customer.pdf`
      - `supplier.png`
    - draft remoto ottenuto con:
      - 1 record `payments`
      - 1 record `expenses`
    - conferma remota riuscita su record reali poi ripuliti
  - **Hardening UX/consistenza aggiunto prima della chiusura**:
    - il draft ora blocca mismatch `cliente/progetto`
    - la selezione progetto riallinea il cliente coerente
    - il file input permette di ricaricare lo stesso file senza dover chiudere
      il launcher

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/ai/UnifiedAiLauncher.test.tsx src/lib/ai/invoiceImport.test.ts src/lib/ai/invoiceImportProvider.test.ts src/lib/semantics/crmCapabilityRegistry.test.ts src/lib/semantics/crmSemanticRegistry.test.ts supabase/functions/_shared/invoiceImportExtract.test.ts`
  - `npm run registry:gen`
  - `npx supabase secrets set GEMINI_API_KEY=... --project-ref qvdmzhyzpyaveniirsmo`
  - `npx supabase functions deploy invoice_import_extract --project-ref qvdmzhyzpyaveniirsmo --no-verify-jwt`
  - invoke autenticato riuscito su `invoice_import_extract` con scrittura smoke
    confermata e poi ripulita

- Decisions:
  - il primo use case reale della chat unificata resta dentro il launcher
    globale, non in una nuova pagina
  - il write path fatture resta confermato dall’utente e non va automatizzato
  - il prossimo step Pareto non è un’altra mini-AI verticale, ma la prima base
    di lettura CRM-wide dentro la stessa shell

### Sessione 55 (2026-02-28, setting Gemini separato per estrazione fatture)

- Completed:
  - **Configurazione AI separata per le fatture aggiunta in Settings**:
    - nuovo default:
      - `gemini-2.5-pro`
    - nuova lista modelli:
      - `invoiceExtractionModelChoices`
    - `Impostazioni -> AI` ora distingue:
      - modelli analitici Storico/Annuale
      - modello Gemini per estrazione fatture
  - **Merge dei config reso compatibile con configurazioni persistite vecchie**:
    - nuovo helper:
      - `mergeConfigurationWithDefaults()`
    - il nuovo campo nested in `aiConfig` non sparisce quando il DB contiene
      ancora solo `historicalAnalysisModel`
  - **Capability/docs allineati nello stesso passaggio**:
    - pagina `settings` descritta anche come punto di scelta del modello
      Gemini fatture

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/lib/ai/invoiceExtractionModel.test.ts src/components/atomic-crm/root/ConfigurationContext.test.ts src/lib/semantics/crmCapabilityRegistry.test.ts`

- Decisions:
  - il modello Gemini per fatture non va mischiato al modello usato per
    Storico/Annuale
  - prima di collegare `@google/genai`, la base corretta e' una config
    esplicita e retrocompatibile

### Sessione 54 (2026-02-28, launcher globale flottante per la chat AI)

- Completed:
  - **Shell AI unificata aggiunta senza aprire una nuova pagina nel menu**:
    - nuovo componente:
      - `UnifiedAiLauncher`
    - bottone piccolo flottante in basso a destra
    - presente nel layout condiviso desktop e mobile
    - apertura in `Sheet`:
      - lato destro desktop
      - dal basso su mobile
  - **Capability registry allineato nello stesso passaggio**:
    - nuovo dialog dichiarato:
      - `unified_ai_launcher_sheet`
    - nuova azione dichiarata:
      - `open_unified_ai_launcher`
  - **Direzione della UX AI resa esplicita anche dentro la shell**:
    - superficie unica
    - nessuna scrittura automatica nel CRM
    - prossimo use case:
      - fatture miste dentro la stessa chat

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/ai/UnifiedAiLauncher.test.tsx src/lib/semantics/crmCapabilityRegistry.test.ts`
  - `npm run registry:gen`

- Decisions:
  - il launcher unificato deve vivere nel layout condiviso, non in una route o
    tab dedicata
  - il prossimo step non è “abbellire la shell”, ma darle un use case reale:
    modello Gemini in settings e ingestione fatture

### Sessione 53 (2026-02-28, verifica remota reale del send Gmail)

- Completed:
  - **Trasporto Gmail verificato davvero sul progetto remoto**:
    - secret `SMTP_*` allineati su `qvdmzhyzpyaveniirsmo`
    - function deployata:
      - `quote_status_email_send`
    - invoke autenticato con utente smoke riuscito
    - risposta provider:
      - `accepted = ["rosariodavide.furnari@gmail.com"]`
      - SMTP `250 2.0.0 OK`
  - **Smoke data ripuliti dopo la verifica**:
    - utente temporaneo eliminato
    - client/quote smoke eliminati
  - **Direzione del prossimo step chiarita nei documenti**:
    - prossimo Pareto step:
      - launcher AI globale flottante
      - non una nuova pagina nel menu
    - subito dopo:
      - setting modello Gemini separato
      - vertical slice ingestione fatture mista dentro la chat unificata

- Validation:
  - `npx supabase secrets set SMTP_* --project-ref qvdmzhyzpyaveniirsmo`
  - `npx supabase functions deploy quote_status_email_send --project-ref qvdmzhyzpyaveniirsmo --no-verify-jwt`
  - invoke autenticato riuscito su `quote_status_email_send`
  - `npx supabase secrets list --project-ref qvdmzhyzpyaveniirsmo`

- Decisions:
  - il send Gmail non e' piu solo “implementato”: ora e' anche verificato su
    runtime remoto
  - il prossimo slice AI deve entrare da un launcher unico e flottante, non da
    una nuova route dedicata
  - il caso fatture va trattato come prima vertical slice della chat unificata,
    non come feature AI sparsa

### Sessione 52 (2026-02-28, invio manuale mail stato preventivo via Gmail)

- Completed:
  - **Invio manuale mail cliente chiuso sul dettaglio preventivo**:
    - nuovo dialog:
      - `SendQuoteStatusEmailDialog`
    - visibile in `QuoteShow`
    - preview soggetto/testo prima dell’invio
    - messaggio opzionale editabile
    - invio solo su conferma esplicita utente
  - **Trasporto reale Gmail SMTP collegato**:
    - nuova function:
      - `quote_status_email_send`
    - auth middleware coerente con le altre function UI-invoked
    - `supabase/config.toml` aggiornato
  - **Contesto mail reso riusabile per UI e AI futura**:
    - nuovo builder:
      - `buildQuoteStatusEmailContext()`
    - nuovi provider entry point:
      - `dataProvider.getQuoteStatusEmailContext()`
      - `dataProvider.sendQuoteStatusEmail()`
    - stesso entry point esposto anche in FakeRest con send mockato
  - **Semantica e capability allineate nello stesso passaggio**:
    - capability registry aggiornato con:
      - azione manuale `quote_send_status_email`
      - provider `gmail_smtp`
      - env richieste `SMTP_*`
    - semantic registry aggiornato con:
      - formula residuo cliente:
        - importo preventivo meno soli pagamenti collegati gia `ricevuto`
      - guardia automatismi su `services.is_taxable`

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/lib/communications/quoteStatusEmailTemplates.test.ts src/lib/communications/quoteStatusEmailContext.test.ts src/lib/semantics/crmCapabilityRegistry.test.ts src/lib/semantics/crmSemanticRegistry.test.ts src/components/atomic-crm/quotes/SendQuoteStatusEmailDialog.test.tsx supabase/functions/_shared/quoteStatusEmailSend.test.ts`

- Decisions:
  - l’invio mail cliente sui cambi stato è chiuso come flusso manuale, non automatico
  - il residuo mostrato nelle mail cliente deve guardare solo agli incassi gia ricevuti, non ai pagamenti soltanto registrati
  - il prossimo default non è aggiungere un altro slice, ma riesaminare se la fase può fermarsi

### Sessione 51 (2026-02-28, continuità blindata per nuova chat)

- Completed:
  - **Handoff rinforzato per ripartenza senza perdita di contesto**:
    - obiettivo finale esplicitato:
      - chat AI unificata su tutto il CRM
      - prima solidità funzionale e semantica
    - vincoli prodotto esplicitati:
      - `Gmail` per mail cliente outbound
      - `CallMeBot` per alert interni urgenti
      - `Postmark` rimosso
      - nessuna mail automatica se ci sono servizi con `is_taxable = false`
    - checklist obbligatoria scritta:
      - semantic registry
      - capability registry
      - communication layer
      - provider entry points
      - test
      - docs di continuità
  - **Primo prossimo step chiarito**:
    - prossimo Pareto step:
      - invio manuale mail cliente sui cambi stato preventivo via `Gmail SMTP`
    - non aprire nuove superfici AI sparse prima di quel collegamento reale

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/lib/communications/quoteStatusEmailTemplates.test.ts src/lib/semantics/crmCapabilityRegistry.test.ts src/lib/semantics/crmSemanticRegistry.test.ts src/components/atomic-crm/dashboard/fiscalModel.test.ts src/components/atomic-crm/dashboard/dashboardAnnualModel.test.ts src/lib/analytics/buildAnnualOperationsContext.test.ts src/components/atomic-crm/payments/paymentLinking.test.ts src/components/atomic-crm/quotes/QuotePaymentsSection.test.tsx src/components/atomic-crm/quotes/quotePaymentsSummary.test.ts src/components/atomic-crm/dashboard/DashboardHistoricalCashInflowCard.test.tsx src/components/atomic-crm/dashboard/DashboardHistorical.ui.test.tsx`

- Decisions:
  - una feature nuova non è considerata integrata se aggiorna solo la UI
  - la continuità di sviluppo per la nuova chat va trattata come parte del
    lavoro, non come nota opzionale

### Sessione 50 (2026-02-28, rimozione Postmark e direzione CallMeBot)

- Completed:
  - **Postmark eliminato dal repo**:
    - rimossa tutta la function:
      - `supabase/functions/postmark/*`
    - rimossa entry da:
      - `supabase/config.toml`
    - rimossa la UI profilo per `Email in entrata`
    - rimossa la variabile locale `VITE_INBOUND_EMAIL`
  - **Direzione notifiche interne fissata**:
    - `CallMeBot` diventa il canale per notifiche interne ad alta priorità
    - aggiornato il capability registry con:
      - provider
      - use case
      - env richieste
      - regole d’uso

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/lib/communications/quoteStatusEmailTemplates.test.ts src/lib/semantics/crmCapabilityRegistry.test.ts`

- Decisions:
  - niente più inbound email via `Postmark`
  - `Gmail` resta il target per mail cliente outbound
  - `CallMeBot` è il target per alert interni urgenti, non per messaggi cliente

### Sessione 48 (2026-02-28, base semantica operativa condivisa)

- Completed:
  - **Base semantica operativa aggiunta per AI e backbone commerciale**:
    - nuovo registry condiviso:
      - `buildCrmSemanticRegistry()`
      - `dataProvider.getCrmSemanticRegistry()`
    - dizionari con descrizioni su:
      - tipi cliente
      - fonte acquisizione
      - categorie/stati progetto
      - stati preventivo
      - tipi/metodi/stati pagamento
      - tipi preventivo e tipi servizio configurabili
    - regole condivise su:
      - `KM percorsi * Tariffa KM`
      - valore netto servizio
      - valore fiscale tassabile
      - lettura delle date con `all_day`
  - **Tassabilità servizio resa esplicita**:
    - nuova migration:
      - `20260228220000_add_service_taxability_and_operational_semantics.sql`
    - nuovo campo:
      - `services.is_taxable`
    - form servizi allineato con default `true`
    - quick episode TV allineato con default tassabile
  - **Tariffa km centralizzata**:
    - nuova config:
      - `operationalConfig.defaultKmRate`
    - servizi, spese e quick episode usano la stessa tariffa predefinita
  - **Separazione corretta tra operativo e fiscale**:
    - il modello fiscale usa solo i servizi tassabili per la base fiscale
    - i KPI business continuano a leggere tutto il valore operativo

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/lib/semantics/crmSemanticRegistry.test.ts src/components/atomic-crm/dashboard/fiscalModel.test.ts src/components/atomic-crm/dashboard/dashboardAnnualModel.test.ts src/lib/analytics/buildAnnualOperationsContext.test.ts`
  - `npx supabase db push`

- Decisions:
  - la base semantica non deve vivere sparsa tra form, liste e prompt
  - per l'AI futura, significati e formule vanno letti da un entry point
    condiviso
  - `is_taxable` decide la base fiscale, non il valore operativo del lavoro

### Sessione 49 (2026-02-28, catalogo capacità CRM e foundation mail stato preventivo)

- Completed:
  - **Catalogo capacità CRM per AI futura aggiunto**:
    - nuovo registry:
      - `buildCrmCapabilityRegistry()`
    - dichiara:
      - risorse principali
      - pagine principali
      - route hash
      - modali/dialog chiave
      - azioni business importanti
      - checklist obbligatoria quando si aggiunge una nuova feature
  - **Foundation template mail per cambi stato preventivo aggiunta**:
    - nuovo builder:
      - `buildQuoteStatusEmailTemplate()`
    - supporta:
      - policy per stato:
        - `never`
        - `manual`
        - `recommended`
      - output `html` e `text`
      - blocchi condivisi
      - campi dinamici mancanti
      - blocco automatico obbligatorio se il flusso include servizi con
        `is_taxable = false`
  - **Direzione provider fissata**:
    - per le mail cliente outbound il target e' `Gmail`
    - il layer attuale resta provider-agnostico finché non arrivano credenziali
      e trasporto reale

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/lib/communications/quoteStatusEmailTemplates.test.ts src/lib/semantics/crmCapabilityRegistry.test.ts src/lib/semantics/crmSemanticRegistry.test.ts`

- Decisions:
  - se una funzione del sito non è dichiarata in un registry leggibile, la chat
    AI futura non può usarla in modo affidabile
  - le mail cliente non devono nascere come testo sparso dentro page component
  - `Postmark` nel repo va considerato separato dal futuro outbound cliente:
    l’obiettivo dichiarato è `Gmail`
  - `is_taxable = false` diventa anche una guardia comunicativa:
    nessuna mail automatica deve partire in questi casi

### Sessione 47 (2026-02-28, quick path cliente -> pagamento)

- Completed:
  - **Chiuso il percorso leggero `cliente -> pagamento`**:
    - nuovo helper condiviso:
      - `buildPaymentCreateDefaultsFromClient()`
      - `buildPaymentCreatePathFromClient()`
    - nuovo accesso diretto nel dettaglio cliente:
      - `Nuovo pagamento`
    - il bottone riusa il form pagamenti già esistente con `client_id`
      precompilato
  - **Base commerciale rafforzata senza nuovi oggetti**:
    - nessuna migration nuova
    - nessun dialog duplicato
    - nessun progetto obbligatorio per i casi semplici

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/payments/paymentLinking.test.ts src/components/atomic-crm/quotes/QuotePaymentsSection.test.tsx src/components/atomic-crm/quotes/quotePaymentsSummary.test.ts`
  - smoke browser autenticato locale su `2026-02-28`:
    - login reale
    - apertura `http://127.0.0.1:4173/#/clients/<id>/show`
    - click su `Nuovo pagamento`
    - arrivo su `http://127.0.0.1:4173/#/payments/create?client_id=<id>`
    - cliente già presente nel form
    - `0` console errors
    - `0` page errors
    - `0` request failures

- Decisions:
  - il caso semplice senza progetto ora ha un percorso esplicito e leggero
    dentro la UI reale
  - questo è un candidato forte a ultimo slice commerciale minimo della fase

### Sessione 46 (2026-02-28, click-test browser chiuso per pagamenti collegati)

- Completed:
  - **Click-test browser reale chiuso sul dettaglio preventivo**:
    - login con utente smoke creato dallo script dedicato
    - apertura route hash corretta:
      - `http://127.0.0.1:4173/#/quotes/<id>/show`
    - verifica del blocco:
      - `Pagamenti collegati`
      - `Ricevuto`
      - `Da ricevere gia registrato`
      - `Ancora da collegare`
      - link `Acconto`
      - link `Saldo`
  - **Verifica numerica chiusa sul caso smoke**:
    - preventivo da `1000,00 €`
    - `200,00 €` ricevuti
    - `300,00 €` in attesa
    - `500,00 €` ancora da collegare

- Validation:
  - `npm run typecheck`
  - smoke browser autenticato locale su `2026-02-28`
  - `0` console errors
  - `0` page errors
  - `0` request failures

- Decisions:
  - il riepilogo pagamenti nel preventivo è ora chiuso anche sul percorso UI
    reale, non solo via test unitari
  - per gli smoke browser locali va usata la route hash `/#/...` e va lasciato
    stabilizzare il post-login prima di aprire una route profonda

### Sessione 45 (2026-02-28, workflow stabile per smoke autenticati)

- Completed:
  - **Procedura auth smoke resa riusabile nel repo**:
    - nuovo script:
      - `scripts/auth-smoke-user.mjs`
    - comandi supportati:
      - `create`
      - `cleanup`
  - **Flusso stabilizzato**:
    - recupera `service_role` dal Supabase CLI del progetto linkato
    - crea utente confermato
    - aspetta la riga `sales`
    - verifica login con password reale
    - pulisce in ordine corretto:
      - `sales`
      - `auth.users`

- Validation:
  - `node scripts/auth-smoke-user.mjs create`
  - `node scripts/auth-smoke-user.mjs cleanup --user-id <id>`

- Decisions:
  - per gli smoke autenticati futuri non si riparte più da zero
  - la strada standard nel repo è lo script dedicato, non one-off improvvisati

- Notes:
  - per gli smoke browser locali di questa app bisogna usare sempre route con
    `#`
  - formato corretto:
    - `http://127.0.0.1:4173/#/...`
  - esempio corretto:
    - `http://127.0.0.1:4173/#/quotes/<id>/show`
  - esempio sbagliato:
    - `http://127.0.0.1:4173/quotes/<id>/show`
  - la creazione/login/cleanup utente smoke resta chiusa e ripetibile con lo
    script dedicato

### Sessione 44 (2026-02-28, riepilogo pagamenti dentro il preventivo)

- Completed:
  - **Nuova visibilità commerciale nel dettaglio preventivo**:
    - nuova sezione:
      - `QuotePaymentsSection`
    - nuovo helper:
      - `buildQuotePaymentsSummary()`
    - il preventivo ora mostra:
      - totale ricevuto
      - totale aperto già registrato
      - differenza ancora non collegata a pagamenti
      - lista pagamenti collegati
  - **Backbone commerciale rafforzato senza burocrazia nuova**:
    - nessuna migration nuova
    - nessun oggetto obbligatorio nuovo
    - il link già esistente `payment.quote_id` viene finalmente reso utile
      anche sul lato preventivo

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/quotes/quotePaymentsSummary.test.ts src/components/atomic-crm/quotes/QuotePaymentsSection.test.tsx src/components/atomic-crm/payments/paymentLinking.test.ts src/components/atomic-crm/quotes/quoteProjectLinking.test.ts src/components/atomic-crm/quotes/quoteItems.test.ts`
  - smoke browser autenticato locale su `2026-02-28`:
    - login reale
    - apertura `http://127.0.0.1:4173/#/quotes/<id>/show`
    - blocco `Pagamenti collegati` visibile
    - `0` console errors
    - `0` page errors
    - `0` request failures

- Decisions:
  - il prossimo slice commerciale deve continuare a valorizzare link già
    esistenti prima di introdurre flussi più pesanti
  - il preventivo resta opzionale, ma se esiste deve diventare un punto di
    controllo vero e non solo un PDF travestito da record

- Notes:
  - il riepilogo usa importi firmati:
    - `rimborso` sottrae
    - gli altri tipi pagamento sommano
  - il testo è volutamente semplice:
    - `Ricevuto`
    - `Da ricevere gia registrato`
    - `Ancora da collegare`

- Next action:
  - scegliere il prossimo slice commerciale minimo
  - evitando di aggiungere automazioni pesanti senza un vantaggio dati chiaro

### Sessione 43 (2026-02-28, vista non-AI storica per incassi)

- Completed:
  - **Primo consumer non-AI degli `incassi` storici aggiunto**:
    - nuova card:
      - `DashboardHistoricalCashInflowCard`
    - integrazione dentro `Storico`
    - riuso del context condiviso:
      - `dataProvider.getHistoricalCashInflowContext()`
  - **Separazione di prodotto preservata**:
    - la card nuova parla solo di soldi già ricevuti
    - i KPI e grafici storici esistenti restano basati su `compensi`
    - nessun widget storico è stato trasformato in vista mista

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/dashboard/DashboardHistoricalCashInflowCard.test.tsx src/components/atomic-crm/dashboard/DashboardHistorical.ui.test.tsx src/components/atomic-crm/dashboard/DashboardHistoricalCashInflowAiCard.test.tsx src/lib/analytics/buildHistoricalCashInflowContext.test.ts`

- Decisions:
  - il primo consumer non-AI degli `incassi` resta una card dedicata, non
    entra nella riga KPI o nei grafici storici esistenti
  - il consumer non-AI usa lo stesso context semantico già usato dal consumer
    AI, così non nasce una seconda definizione di `incassi`

- Notes:
  - nella lista anni la cifra ora è mostrata in valuta piena, non compatta
  - le etichette conteggio sono state rese leggibili anche al singolare:
    - `1 pagamento ricevuto`
    - `1 progetto`
    - `1 cliente`

- Next action:
  - tenere allineati test e context se la card evolve
  - poi scegliere il prossimo slice commerciale minimo

### Sessione 42 (2026-02-28, consumer AI storico per incassi)

- Completed:
  - **Primo consumer AI-safe degli `incassi` storici aggiunto**:
    - nuova card:
      - `DashboardHistoricalCashInflowAiCard`
    - nuove function:
      - `historical_cash_inflow_summary`
      - `historical_cash_inflow_answer`
    - nuovi metodi provider:
      - `generateHistoricalCashInflowSummary()`
      - `askHistoricalCashInflowQuestion()`
  - **Separazione di prodotto preservata**:
    - la card nuova parla solo di soldi già ricevuti
    - i widget storici esistenti restano basati su `compensi`
    - nessun widget storico è stato trasformato in vista mista

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/components/atomic-crm/dashboard/DashboardHistoricalCashInflowAiCard.test.tsx src/components/atomic-crm/dashboard/DashboardHistoricalAiSummaryCard.test.tsx src/components/atomic-crm/dashboard/DashboardHistorical.ui.test.tsx src/lib/analytics/buildHistoricalCashInflowContext.test.ts`
  - deploy remoto:
    - `historical_cash_inflow_summary`
    - `historical_cash_inflow_answer`
  - browser click-test autenticato OK su `2026-02-28`:
    - login reale con utente temporaneo
    - apertura `Storico`
    - summary guidata `Spiegami gli incassi`
    - domanda suggerita:
      - `Qual è stato l'anno con più incassi ricevuti?`
    - nessun errore console
    - nessun `pageerror`

- Decisions:
  - il primo consumer `incassi` resta una card AI separata, non una modifica ai
    KPI o grafici storici esistenti
  - per nuove function invocate dalla UI bisogna allineare anche
    `supabase/config.toml` con:
    - `verify_jwt = false`
    - come già fatto per le altre function AI attive

- Notes:
  - il primo deploy delle function `incassi` falliva nel browser con
    `401 Invalid JWT`
  - la causa non era il context né il middleware applicativo:
    - mancavano le entry dedicate in `supabase/config.toml`
  - aggiunte:
    - `[functions.historical_cash_inflow_summary]`
    - `[functions.historical_cash_inflow_answer]`
    - entrambe con `verify_jwt = false`

- Next action:
  - mantenere allineati test, docs e config function quando si apre il prossimo
    slice AI o commerciale

### Sessione 41 (2026-02-28, semantica storica incassi)

- Completed:
  - **Primo layer semantico storico degli `incassi` aggiunto**:
    - nuova view:
      - `analytics_yearly_cash_inflow`
    - nuovo context builder:
      - `buildHistoricalCashInflowContext()`
    - nuovo entry point nel provider:
      - `dataProvider.getHistoricalCashInflowContext()`
  - **Separazione esplicita mantenuta**:
    - `compensi`
      - base temporale `services.service_date`
    - `incassi`
      - base temporale `payments.payment_date`
      - solo pagamenti `ricevuto`
      - `rimborso` esclusi
  - **Copertura minima aggiunta**:
    - metriche semantiche:
      - `historical_total_cash_inflow`
      - `latest_closed_year_cash_inflow`
    - test mirati sul context builder

- Validation:
  - `npm run typecheck`
  - `npm test -- --run src/lib/analytics/buildHistoricalCashInflowContext.test.ts src/components/atomic-crm/dashboard/dashboardHistoryModel.test.ts`
  - `npx supabase db push`
  - query remota con `service_role` OK sulla nuova view:
    - `2025` anno chiuso:
      - `cash_inflow = 22241.64`
      - `payments_count = 11`
    - `2026` YTD:
      - `cash_inflow = 1744.00`
      - `payments_count = 1`
  - query remota autenticata con utente temporaneo OK:
    - `analytics_history_meta`
    - `analytics_yearly_cash_inflow`

- Decisions:
  - il layer storico degli `incassi` vive per ora come resource semantica
    separata, non dentro la UI `Storico`
  - il prossimo passo non è rifare il dashboard storico, ma decidere un primo
    consumer AI-safe del nuovo context

- Notes:
  - la migration iniziale falliva per una `generate_series(min(...),
    current_year)` scritta nello stesso CTE dell'aggregazione:
    - il fix corretto è stato separare i bounds in un CTE dedicato
  - su questa macchina `supabase db dump` non è stato utile per la verifica
    remota perché richiede Docker attivo:
    - per confermare la leggibilità reale lato frontend, la verifica utile è
      stata REST autenticata

- Next action:
  - definire il primo consumer AI-safe del nuovo context `incassi`
  - mantenendo esplicito che:
    - `compensi != incassi`

### Sessione 40 (2026-02-28, browser click-test Annuale payment/open-quote)

- Completed:
  - **Click-test browser mirato di `Annuale` chiuso**:
    - login reale con utente temporaneo
    - apertura della dashboard `Annuale`
    - trigger della domanda suggerita:
      - `Cosa raccontano pagamenti e preventivi del 2026?`
    - risposta AI renderizzata correttamente nel browser reale
  - **Evidenza raccolta sul comportamento reale**:
    - la risposta ha citato `Diego Caltabiano`
    - la risposta ha spiegato correttamente che nel perimetro `2026` non
      risultavano preventivi aperti
    - nessun errore console
    - nessun page error

- Validation:
  - click-test browser autenticato OK su `2026-02-28`
  - runtime locale Vite:
    - `http://127.0.0.1:4173/`
  - automazione usata:
    - Playwright via `npx`
    - Google Chrome installato nella macchina

- Decisions:
  - il question set `pagamenti/preventivi` di `Annuale` è ora chiuso sia lato
    remote smoke sia lato browser reale
  - il prossimo step utile non è altro hardening su Annuale, ma il ponte
    semantico storico degli `incassi`

- Notes:
  - per smoke browser locali su questa macchina, `playwright` via `npx` con il
    Chrome già installato è molto più affidabile del pilotaggio CDP raw

- Next action:
  - aprire la semantica storica degli `incassi`
  - mantenendo esplicita la distinzione:
    - `compensi`
    - `incassi`

### Sessione 39 (2026-02-28, remote validation Annuale drill-down)

- Completed:
  - **Validazione remota chiusa sul nuovo drill-down di `Annuale`**:
    - creato utente temporaneo autenticato sul progetto remoto
    - costruito localmente il vero contesto `annual_operations`
    - invocata la Edge Function `annual_operations_answer`
    - cleanup automatico di utente e riga `sales` a fine run
  - **Evidenza raccolta sul comportamento reale dell'AI**:
    - anno selezionato dallo smoke: `2026`
    - drill-down presente nel contesto:
      - `2` pagamenti da ricevere
      - `0` preventivi aperti
    - la risposta AI ha citato il cliente concreto presente nel drill-down:
      - `Diego Caltabiano`
    - la risposta ha anche dichiarato correttamente che non risultavano
      preventivi aperti nel perimetro osservato

- Validation:
  - smoke remoto autenticato OK su `2026-02-28`
  - modello usato: `gpt-5.2`
  - nessun deploy aggiuntivo necessario:
    - il nuovo contesto è stato accettato dalle function Annuale già attive

- Decisions:
  - il nuovo drill-down non richiede altro payload per ora
  - il prossimo step utile è solo la verifica browser sulla stessa famiglia di
    domande, non un nuovo refactor del semantic layer

- Notes:
  - un one-off script TypeScript locale basta per validare il path reale della
    function quando non c'è ancora un tooling browser dedicato nel repo
  - il passaggio `quote_items -> open quote drill-down -> AI answer` ora è
    chiuso anche lato runtime reale, non solo nei test

- Next action:
  - click-test browser di `Annuale` con domanda su:
    - `pagamenti da ricevere`
    - `preventivi aperti`
  - verificare che la risposta resti concreta ma non scivoli su:
    - alert snapshot
    - simulazione fiscale

### Sessione 38 (2026-02-28, drill-down AI-safe per Annuale)

- Completed:
  - **Drill-down semantico aggiunto in `annual_operations`**:
    - nuovo blocco `drilldowns.pendingPayments`
    - nuovo blocco `drilldowns.openQuotes`
    - il dettaglio vive nel model/context layer, non dentro la card UI
  - **Backbone commerciale collegato meglio al layer AI**:
    - i pagamenti da ricevere ora portano anche:
      - cliente
      - progetto opzionale
      - preventivo opzionale
      - stato
      - data pagamento
    - i preventivi aperti ora portano anche:
      - cliente
      - progetto opzionale
      - stato leggibile
      - segnale se sono già itemizzati
      - numero voci itemizzate
  - **Regola semantica mantenuta**:
    - questo drill-down non coincide con gli alert giornalieri
    - `pagamenti da ricevere` restano incassi attesi
    - `preventivi aperti` restano pipeline potenziale

- Validation:
  - `npm run typecheck` OK
  - `npm test -- --run src/components/atomic-crm/dashboard/dashboardAnnualModel.test.ts src/lib/analytics/buildAnnualOperationsContext.test.ts supabase/functions/_shared/annualOperationsAiGuidance.test.ts` OK
  - totale: `8` test verdi
  - nessun deploy Edge Function necessario:
    - le function AI Annuale ricevono già il contesto JSON dal client/provider

- Decisions:
  - il prossimo passo utile non è aggiungere altro payload, ma verificare la
    resa reale delle risposte AI di `Annuale` su domande mirate a pagamenti e
    preventivi

- Notes:
  - portare il drill-down nel semantic layer evita di ricostruire logiche
    diverse nella UI o nel prompt
  - l'informazione `hasItemizedLines` collega già il nuovo foundation
    `quote_items` con il contesto AI senza forzare un builder più pesante

- Next action:
  - validare `Annuale` AI con domande su:
    - `pagamenti da ricevere`
    - `preventivi aperti`
  - verificare che la risposta resti fuori da:
    - alert snapshot
    - simulazione fiscale

### Sessione 37 (2026-02-28, foundation `quote_items`)

- Completed:
  - **Foundation `quote_items` chiusa senza riaprire l'architettura**:
    - nuova migration `20260228190000_add_quote_items_json.sql`
    - `quote_items` salvati direttamente dentro `quotes` come array JSONB
    - nessun nuovo modulo CRUD separato
    - il preventivo classico `descrizione + importo` resta valido
    - se ci sono voci, l'importo totale viene calcolato automaticamente
  - **UI preventivi aggiornata**:
    - create/edit con sezione ripetibile `Voci preventivo`
    - importo bloccato in modifica quando il preventivo è itemizzato
    - show con righe voce per voce e totale per riga
    - PDF con rendering itemizzato quando presente
  - **Fix runtime emerso dal browser smoke**:
    - il lookup cliente del preventivo usava il filtro generico `q`
    - sul Supabase reale falliva con `column clients.q does not exist`
    - introdotto helper condiviso `name@ilike` per lookup nominali in:
      - `QuoteInputs`
      - `QuoteList`
      - `TaskFormContent`

- Validation:
  - `npm run typecheck` OK
  - `npm test -- --run src/components/atomic-crm/quotes/quoteItems.test.ts src/components/atomic-crm/misc/referenceSearch.test.ts src/components/atomic-crm/payments/paymentLinking.test.ts src/components/atomic-crm/quotes/CreateProjectFromQuoteDialog.test.tsx src/components/atomic-crm/quotes/quoteProjectLinking.test.ts` OK
  - totale: `16` test verdi
  - `npx supabase db push` OK
    - migration applicata al remoto:
      - `20260228190000_add_quote_items_json.sql`
  - smoke browser autenticato OK su `2026-02-28`:
    - creazione di un preventivo itemizzato dalla UI reale
    - importo calcolato correttamente dalle voci
    - show del preventivo con righe itemizzate visibili
    - nessun errore console dopo il fix `name@ilike`

- Decisions:
  - `quote_items` restano embedded nel preventivo, non diventano ora un nuovo
    modulo autonomo
  - il passo successivo più utile non è un altro builder UI, ma un drill-down
    AI-safe di `pagamenti da ricevere` e `preventivi aperti` dentro
    `annual_operations`

- Notes:
  - per lookup nominali su resource Supabase reali non conviene fidarsi del
    fallback generico `q`
  - la struttura embedded dei `quote_items` è abbastanza forte per il backbone
    commerciale attuale senza introdurre burocrazia inutile

- Next action:
  - aggiungere drill-down AI-safe per:
    - `pagamenti da ricevere`
    - `preventivi aperti`
  - solo se utile dopo review:
    - polish prompt/markdown delle card AI

### Sessione 36 (2026-02-28, quick payment dal preventivo)

- Completed:
  - **Quick payment dal preventivo aggiunto**:
    - nuova CTA `Registra pagamento` nella scheda preventivo
    - apertura di `PaymentCreate` con prefill da query string
    - preallineamento di:
      - `quote_id`
      - `client_id`
      - `project_id` solo se il progetto esiste già
  - **Regola di dominio resa esplicita**:
    - il preventivo non diventa obbligatorio
    - il progetto non diventa obbligatorio
    - il percorso semplice `preventivo -> pagamento` resta valido per casi come
      `wedding`

- Validation:
  - `npm run typecheck` OK
  - `npm test -- --run src/components/atomic-crm/payments/paymentLinking.test.ts src/components/atomic-crm/quotes/CreateProjectFromQuoteDialog.test.tsx src/components/atomic-crm/quotes/quoteProjectLinking.test.ts` OK
  - totale: `11` test verdi
  - smoke browser autenticato OK su `2026-02-28`:
    - apertura di un preventivo `wedding` senza progetto
    - click su `Registra pagamento`
    - form pagamento aperto con preventivo e cliente già allineati
    - progetto lasciato vuoto
    - pagamento salvato con successo dalla UI reale

- Decisions:
  - `preventivo` e `progetto` restano acceleratori opzionali, non gateway
    obbligatori
  - il prossimo slice commerciale non è più il quick payment ma la foundation
    `quote_items`

- Notes:
  - nei smoke browser su componenti `Select` Radix conviene usare locator per
    ruolo/indice se il testo label contiene formattazioni accessibili variabili
  - nello show del preventivo la CTA `Registra pagamento` è resa come link,
    non come button

- Next action:
  - aprire il foundation work di `quote_items`
  - solo se utile dopo review:
    - polish prompt/markdown delle card AI

### Sessione 35 (2026-02-28, storico free-question browser validation)

- Completed:
  - **Click-test browser del free-question path di `Storico` chiuso**:
    - login autenticato su runtime locale Vite contro il Supabase remoto del
      repo
    - apertura tab `Storico`
    - inserimento manuale di una domanda libera nel textarea
    - invio della richiesta dalla UI reale
    - risposta AI renderizzata correttamente in browser
  - **Evidenza raccolta sul comportamento reale**:
    - modello usato: `gpt-5.2`
    - risposta in italiano semplice
    - contenuto ancorato ai dati storici visibili
    - nessun errore console emerso nel flusso Q&A

- Validation:
  - click-test browser autenticato OK su `2026-02-28`
  - utente temporaneo creato via `service_role` e poi pulito
  - domanda usata nel test:
    - `Quali anni sono andati meglio e per quale motivo, spiegato in modo semplice?`
  - risposta osservata:
    - identificazione del `2025` come anno migliore rispetto al `2024`
    - motivazione principale legata alla crescita della `produzione TV`

- Decisions:
  - il free-question path di `Storico` è ora considerato chiuso anche lato
    browser, non solo via test e smoke remoto
  - il prossimo task primario diventa la scelta del prossimo slice commerciale
    minimo

- Notes:
  - per pulire utenti temporanei creati via admin API sul progetto remoto
    conviene cancellare prima la riga dipendente in `sales` e poi l'utente auth,
    altrimenti il vincolo FK blocca la delete
  - per il toggle `Annuale | Storico` è più robusto usare il locator basato su
    `aria-label` nelle smoke browser future

- Next action:
  - scegliere il prossimo slice commerciale minimo:
    - `smart-link / quick payment` dal preventivo
    - oppure `quote_items`
  - solo se utile dopo review:
    - polish prompt/markdown delle card AI

### Sessione 34 (2026-02-28, browser validation + runtime fixes)

- Completed:
  - **Click-test browser commerciale chiuso sul percorso reale**:
    - creato progetto da un preventivo senza `project_id`
    - verificato il ritorno del link progetto nella scheda preventivo
    - aperto `PaymentCreate`
    - selezionato il preventivo collegato
    - verificato l'allineamento automatico di:
      - cliente
      - progetto
    - salvato un pagamento e verificata la presenza dei link a:
      - progetto
      - preventivo
  - **Click-test browser Annuale AI chiuso**:
    - generata la spiegazione guidata su `Annuale`
    - inviata una domanda suggerita
    - verificato che la risposta resti nel perimetro operativo
  - **Bug runtime emersi dallo smoke e corretti**:
    - `CreateProjectFromQuoteDialog` assumeva che `useCreate(..., { returnPromise: true })`
      restituisse sempre `{ data }`
    - nel runtime reale arrivava invece il record diretto
    - fix:
      - normalizzazione del risultato mutation prima di leggere `id`
    - il lookup preventivi nel form pagamenti usava il filtro generico `q`
    - nel runtime reale il resource `quotes` non rendeva trovabile in modo
      affidabile la descrizione appena creata
    - fix:
      - ricerca esplicita su `description@ilike`
  - **Test di regressione aggiunti**:
    - `CreateProjectFromQuoteDialog.test.tsx`
    - `paymentLinking.test.ts` esteso per il filtro ricerca preventivo

- Validation:
  - `npm run typecheck` OK
  - `npm test -- --run src/components/atomic-crm/quotes/CreateProjectFromQuoteDialog.test.tsx src/components/atomic-crm/quotes/quoteProjectLinking.test.ts src/components/atomic-crm/payments/paymentLinking.test.ts` OK
  - totale: `8` test verdi
  - smoke browser autenticato OK su `2026-02-28`:
    - runtime locale Vite contro il Supabase remoto configurato dal repo
    - utente temporaneo creato via `service_role`
    - record temporanei creati e poi puliti
    - commercial chain `Quote -> Project -> Payment` verificata
    - `Annuale` AI summary + suggested question verificate

- Decisions:
  - non riaprire ora l'architettura commerciale oltre il grafo minimo già
    approvato
  - mantenere `Annuale` AI sul solo contesto `annual_operations`
  - spostare il prossimo sforzo AI lato browser sul free-question path di
    `Storico`

- Notes:
  - il repo gira in hash routing (`/#/`), dettaglio utile per futuri smoke
    browser automatizzati
  - per i test remoti con dati temporanei conviene sempre creare record con
    prefisso univoco e pulirli a fine run
  - la baseline stabile pubblicata resta `83a3308` finché l'utente non chiede
    commit/push

- Next action:
  - click-test browser del free-question path in `Storico`
  - poi scegliere il prossimo slice commerciale minimo:
    - `smart-link / quick payment` dal preventivo
    - oppure `quote_items`

### Sessione 30 (2026-02-28, annual semantic normalization)

- Completed:
  - **Base ricavi Annuale unificata**:
    - il runtime annuale non usa più `monthly_revenue` per calcolare KPI,
      grafico, categorie e top clienti
    - questi blocchi ora derivano tutti dai `services`
    - stessa base ovunque: fee nette di sconto
  - **Anno corrente letto come finora**:
    - i servizi futuri dell'anno corrente vengono esclusi dai totali operativi
    - il grafico annuale mostra ora solo i mesi dell'anno selezionato
      realmente nel perimetro (`gen-feb` per `2026` al `28/02/2026`, non più
      trailing 12 months)
  - **Semantica esplicita in UI**:
    - aggiunta card `Come leggere Annuale`
    - KPI e chart riscritti per distinguere:
      - valore del lavoro
      - incassi attesi
      - pipeline potenziale
      - simulazione fiscale
  - **Fiscale/business health riallineati**:
    - `quoteConversionRate`, `weightedPipelineValue` e `DSO` filtrano davvero
      sull'anno selezionato
    - `weightedPipelineValue` non conta più i preventivi già vinti come
      opportunità ancora aperte
    - copy fiscale resa meno assertiva: simulazione, non consuntivo fiscale
  - **Migrazione difensiva aggiunta**:
    - nuova migration
      `20260228150000_normalize_monthly_revenue_net_basis.sql`
    - normalizza anche la view `monthly_revenue` alla stessa base netta di
      sconto per evitare usi futuri ambigui
  - **Test annuali aggiunti**:
    - `dashboardAnnualModel.test.ts`
    - copre esclusione servizi futuri, base netta coerente e filtri fiscali
      sullo `selectedYear`

- Validation:
  - `npm run typecheck` OK
  - `npm test -- --run src/components/atomic-crm/dashboard/dashboardAnnualModel.test.ts src/components/atomic-crm/dashboard/DashboardHistoricalAiSummaryCard.test.tsx src/components/atomic-crm/dashboard/DashboardHistorical.ui.test.tsx src/components/atomic-crm/dashboard/DashboardHistoricalWidgets.test.tsx src/components/atomic-crm/dashboard/dashboardHistoryModel.test.ts` OK
  - totale: `17` test verdi

- Decisions:
  - `Annuale` non va ancora collegata direttamente all'AI come blocco unico
  - Il prossimo consumer AI corretto deve nascere solo sul sottoinsieme
    `annual_operations`
  - `alerts` e `fiscal_simulation` restano semanticamente separati e vanno
    trattati come contesti distinti

- Notes:
  - Nessun deploy remoto necessario per il runtime attuale: il refactor annuale
    gira client-side sui `services`
  - La migration sulla view `monthly_revenue` è presente nel repo ma non ancora
    pushata al progetto remoto in questa sessione
  - La baseline stabile già pushata resta `5ed2a10` finché l'utente non chiede
    un nuovo commit/push

- Next action:
  - costruire `annual_operations` context AI-ready
  - solo dopo valutare una card AI in `Annuale`

### Sessione 31 (2026-02-28, annual operations AI flow)

- Completed:
  - **Migration remota applicata**:
    - `20260228150000_normalize_monthly_revenue_net_basis.sql`
      pushata sul progetto remoto
  - **Context AI-safe per Annuale aggiunto**:
    - creato `buildAnnualOperationsContext()`
    - include solo la parte operativa dell'anno scelto:
      - valore del lavoro
      - categorie
      - top clienti
      - pagamenti da ricevere
      - preventivi aperti
    - esclude esplicitamente:
      - simulazione fiscale
      - alert giornalieri
  - **Primo consumer Annuale aggiunto**:
    - nuova card `DashboardAnnualAiSummaryCard`
    - summary guidato
    - domanda libera single-turn
    - reset automatico quando cambia anno selezionato
  - **Provider ed Edge Functions Annuale aggiunti**:
    - `getAnnualOperationsAnalyticsContext(year)`
    - `generateAnnualOperationsAnalyticsSummary(year)`
    - `askAnnualOperationsQuestion(year, question)`
    - nuove function remote:
      - `annual_operations_summary`
      - `annual_operations_answer`
  - **Mobile incluso**:
    - la card AI annuale compare anche nel dashboard mobile
  - **Test aggiunti**:
    - `buildAnnualOperationsContext.test.ts`
    - `DashboardAnnualAiSummaryCard.test.tsx`

- Validation:
  - `npm run typecheck` OK
  - `npm test -- --run src/components/atomic-crm/dashboard/dashboardAnnualModel.test.ts src/lib/analytics/buildAnnualOperationsContext.test.ts src/components/atomic-crm/dashboard/DashboardAnnualAiSummaryCard.test.tsx src/components/atomic-crm/dashboard/DashboardHistoricalAiSummaryCard.test.tsx src/components/atomic-crm/dashboard/DashboardHistorical.ui.test.tsx src/components/atomic-crm/dashboard/DashboardHistoricalWidgets.test.tsx src/components/atomic-crm/dashboard/dashboardHistoryModel.test.ts` OK
  - totale: `21` test verdi
  - `npx supabase db push` OK
  - deploy remoto OK:
    - `annual_operations_summary`
    - `annual_operations_answer`
  - smoke remoto autenticato OK sul progetto `qvdmzhyzpyaveniirsmo`
    - year `2025`
    - summary `200` con `## In breve`
    - answer `200` con `## Risposta breve`
    - modello `gpt-5.2`
    - nessun riferimento spurio al fiscale nella risposta operativa

- Decisions:
  - `Annuale` non viene passato all'AI come pagina unica
  - il solo blocco operativo viene esposto come `annual_operations`
  - fiscale e alert restano volutamente separati anche se visibili nella stessa
    schermata

- Notes:
  - il primo smoke remoto ha rivelato che `annual_operations_summary` non era
    realmente presente sul remoto nonostante un primo deploy CLI sembrasse
    riuscito
  - la verifica con `supabase functions list` ha mostrato l'assenza reale
  - un secondo deploy della summary ha risolto il problema
  - in questa sessione non e stato eseguito un click-test browser del nuovo
    flusso AI su `Annuale`
  - la baseline stabile già pushata resta `5ed2a10` finché l'utente non chiede
    commit/push

- Next action:
  - click-test browser di `Annuale`
  - poi decidere la prossima sezione da rendere AI-safe (`Pagamenti` e la
    candidata migliore)

### Sessione 32 (2026-02-28, annual hardening and AI-driving refocus)

- Completed:
  - **Hardening minimo del Q&A annuale**:
    - aggiunto helper condiviso
      `annualOperationsAiGuidance.ts`
    - regole esplicite contro:
      - frasi assolute
      - interpretazioni negative automatiche sui valori a `0`
      - confusione tra anno chiuso e situazione attuale dell'azienda
    - le domande ambigue vengono ora riformulate internamente prima della
      chiamata al modello
  - **Suggerimenti UI Annuale resi meno ambigui**:
    - niente più `quest'anno` fisso anche quando l'anno selezionato è chiuso
    - le domande suggerite ora dipendono da `year` e `isCurrentYear`
  - **Validazione remota sui casi reali utente**:
    - redeploy di `annual_operations_summary`
    - redeploy di `annual_operations_answer`
    - smoke autenticato ripetuto sulle domande reali del 2025:
      - `Qual è il punto più debole da controllare?`
      - `Cosa raccontano pagamenti e preventivi aperti?`
      - `Cosa sta trainando quest'anno?`
      - `Da chi arriva il valore del lavoro?`
    - il testo risultante è rientrato nei binari attesi:
      - niente diagnosi automatiche da valori a `0`
      - niente riferimenti a `oggi` / `futuro` su anno chiuso
      - tono più prudente sui clienti dominanti

- Validation:
  - `npm run typecheck` OK
  - `npm test -- --run supabase/functions/_shared/annualOperationsAiGuidance.test.ts src/components/atomic-crm/dashboard/DashboardAnnualAiSummaryCard.test.tsx src/lib/analytics/buildAnnualOperationsContext.test.ts src/components/atomic-crm/dashboard/dashboardAnnualModel.test.ts` OK
  - totale: `9` test verdi
  - deploy remoto aggiornato OK:
    - `annual_operations_summary`
    - `annual_operations_answer`
  - smoke remoto autenticato OK sui casi reali utente

- Decisions:
  - fermare ulteriore prompt tuning fine sulla card `Annuale`
  - mantenere solo un hardening minimo anti-bufala
  - spostare il focus delle prossime sessioni dal copy/prompt al rollout
    `AI-driving` del sistema:
    - semantic layer
    - tool contract
    - moduli AI-safe

- Notes:
  - il problema residuo più concreto non è il prompt, ma l'assenza di
    drill-down strutturato per alcuni dati annuali aggregati, per esempio i
    dettagli dei `pagamenti da ricevere`
  - la baseline stabile già pushata resta `5ed2a10` finché l'utente non chiede
    commit/push

- Next action:
  - click-test browser finale della card AI di `Annuale`
  - poi definire il piano architetturale `AI-driving` e il prossimo modulo
    semantico/tool-safe, con `Pagamenti` come candidato naturale

### Sessione 33 (2026-02-28, commercial backbone slice 1)

- Completed:
  - **Quote -> Project link introdotto**:
    - nuova migration `20260228170000_add_quotes_project_link.sql`
    - `Quote` ora supporta `project_id`
    - il form preventivo può collegarsi a un progetto esistente
  - **Create Project from Quote**:
    - nuova dialog `CreateProjectFromQuoteDialog`
    - accessibile dalla scheda preventivo quando il preventivo è in stato
      operativo e non ha ancora un progetto collegato
    - default sicuri ma sempre editabili:
      - nome suggerito
      - categoria precompilata solo se il mapping è univoco
      - date/budget dal preventivo
    - alla creazione il progetto viene anche collegato al preventivo
  - **Payment flow più coerente**:
    - `PaymentInputs` ora supporta `quote_id`
    - selezionando un preventivo:
      - il cliente viene allineato
      - il progetto collegato viene precompilato se presente
    - se il cliente cambia e i link diventano incoerenti:
      - `quote_id` / `project_id` vengono puliti
  - **UI cross-link migliorata**:
    - `QuoteShow` mostra il progetto collegato o il CTA per crearlo
    - `PaymentShow` e `PaymentListContent` mostrano anche il preventivo
    - export CSV preventivi include `progetto_collegato`
  - **Test helper aggiunti**:
    - `quoteProjectLinking.test.ts`
    - `paymentLinking.test.ts`

- Validation:
  - `npm run typecheck` OK
  - `npm test -- --run src/components/atomic-crm/quotes/quoteProjectLinking.test.ts src/components/atomic-crm/payments/paymentLinking.test.ts` OK
  - totale: `6` test verdi
  - `npx supabase db push` OK
    - migration applicata al remoto:
      - `20260228170000_add_quotes_project_link.sql`

- Decisions:
  - non partire ancora con `quote_items` / PDF live / automazioni pesanti
  - prima chiudere bene il grafo minimo:
    - preventivo collegato a progetto
    - pagamento collegato a preventivo/progetto
  - riduzione click sì, ma senza automazioni irreversibili

- Notes:
  - questo è il primo slice della spina dorsale commerciale, non il rollout AI
    del modulo preventivi
  - la priorità architetturale resta: CRM affidabile prima dell'AI estesa

- Next action:
  - click-test browser dei nuovi flussi:
    - collega preventivo a progetto esistente
    - crea progetto dal preventivo
    - registra pagamento con preventivo collegato
  - poi decidere il secondo slice:
    - smart-link / quick payment dal preventivo
    - oppure quote items come base del builder

### Sessione 29 (2026-02-28, historical Q&A single-turn)

- Completed:
  - **Domande libere sullo storico aggiunte**:
    - nuovo metodo `dataProvider.askHistoricalAnalyticsQuestion()`
    - nuovo tipo `HistoricalAnalyticsAnswer`
    - nuove domande suggerite whitelisted per il tab `Storico`
  - **Edge Function separata per non rompere la baseline stabile**:
    - creata `historical_analytics_answer`
    - prompt vincolato a italiano semplice
    - risposta strutturata in `Risposta breve`, `Perché lo dico`,
      `Cosa controllare adesso`
    - limite domanda `300` caratteri
  - **Card AI estesa senza trasformarla in chat generale**:
    - textarea `Fai una domanda su questi numeri`
    - chip con domande suggerite
    - guardrail esplicito: solo dati storici visibili
    - stesso componente mantiene anche `Spiegami lo storico`
  - **Copertura test aggiornata**:
    - aggiunto `DashboardHistoricalAiSummaryCard.test.tsx`
    - verificati sia il flusso summary sia il flusso domanda suggerita
  - **Deploy remoto chiuso**:
    - `historical_analytics_answer` deployata su
      `qvdmzhyzpyaveniirsmo`
    - smoke autenticato end-to-end OK con utente temporaneo

- Validation:
  - `npm run typecheck` OK
  - `npm test -- --run src/components/atomic-crm/dashboard/DashboardHistoricalAiSummaryCard.test.tsx src/components/atomic-crm/dashboard/DashboardHistorical.ui.test.tsx src/components/atomic-crm/dashboard/DashboardHistoricalWidgets.test.tsx src/components/atomic-crm/dashboard/dashboardHistoryModel.test.ts` OK
  - authenticated remote smoke di `historical_analytics_answer` OK
    - status `200`
    - model `gpt-5.2`
    - output con `## Risposta breve`
    - niente raw `YTD` / `YoY`

- Decisions:
  - La modalità giusta per questo prodotto non è una chat libera su tutto il
    CRM, ma un Q&A vincolato ai dati storici già validati
  - Il nuovo Q&A resta single-turn e separato dal summary per proteggere la
    baseline già stabile
  - Il linguaggio semplice resta requisito di prodotto anche nelle risposte a
    domanda libera

- Notes:
  - Il primo smoke remoto ha fallito con `Requested function was not found`
    perché la nuova Edge Function non era ancora deployata sul progetto
  - Dopo `npx supabase functions deploy historical_analytics_answer --project-ref qvdmzhyzpyaveniirsmo`
    il re-test è passato subito
  - In questa sessione non è stato eseguito il click-test browser del nuovo
    campo domanda libera
  - La baseline stabile già pushata resta `237ccbc` finché l'utente non chiede
    un nuovo commit/push

- Next action:
  - opzionale: click-test browser del nuovo Q&A nel tab `Storico`
  - opzionale: piccolo polish di copy/layout della risposta AI
  - altrimenti nessun blocco tecnico aperto sul perimetro storico v1

### Sessione 28 (2026-02-28, plain-language UX layer)

- Completed:
  - **Traduzione del linguaggio UI**: rimosso il gergo più ostico dalla
    superficie del dashboard storico
    - `YTD` -> `finora` / `anno in corso fino a oggi`
    - `YoY` -> `crescita rispetto all'anno prima`
    - `competenza` -> spiegazione come `valore del lavoro`, non come termine
      contabile
  - **Dashboard più leggibile per il titolare**:
    - KPI rinominati in linguaggio operativo
    - card `Come leggere lo storico` riscritta come `Tradotto in semplice`
    - card contesto riscritta senza lessico da analista
  - **Prompt AI riscritto**:
    - vietato il gergo non spiegato
    - nuove sezioni `In breve`, `Cose importanti`, `Attenzione`,
      `Cosa controllare adesso`
  - **Deploy remoto aggiornato**:
    - redeploy di `historical_analytics_summary`
    - smoke remoto OK con risposta in italiano semplice

- Validation:
  - `npm run typecheck` OK
  - `npm test -- --run src/components/atomic-crm/dashboard/DashboardHistorical.ui.test.tsx src/components/atomic-crm/dashboard/DashboardHistoricalWidgets.test.tsx src/components/atomic-crm/dashboard/dashboardHistoryModel.test.ts` OK
  - remote prompt smoke OK con output che inizia da `## In breve`

- Decisions:
  - La correttezza semantica da sola non basta: il prodotto deve tradurre i
    numeri in lingua imprenditoriale
  - Da questo punto in poi il linguaggio semplice va considerato parte del
    contratto UX, non un abbellimento facoltativo

- Next action:
  - nessun blocco tecnico aperto sul v1 storico
  - se vuoi consolidare, commit/push di questa chiusura finale
  - in futuro solo refine opzionale o nuove capability prodotto

### Sessione 27 (2026-02-28, UI test closure)

- Completed:
  - **Infrastruttura test UI aggiunta**:
    - `jsdom`
    - `@testing-library/react`
    - `src/setupTests.js` esteso con cleanup automatico e `ResizeObserver`
      fallback
  - **UI tests storici aggiunti**:
    - `DashboardHistorical.ui.test.tsx`
    - `DashboardHistoricalWidgets.test.tsx`
  - **Copertura chiusa sui casi minimi critici**:
    - empty state parent
    - error state parent + retry
    - warning contestuale YoY
    - error state widget
    - empty state widget
    - YoY `N/D`
  - **Polish card AI**: migliorata la leggibilità del markdown con bullets e
    spacing visibile
  - **Docs di continuità riallineati**: handoff/backlog/spec/progress
    aggiornati allo stato quasi finale

- Decisions:
  - Per questo v1 il lavoro implementativo si considera sostanzialmente chiuso
  - Le prossime modifiche non sono più fix strutturali ma solo polish o nuove
    richieste di prodotto
  - I widget storici ora vanno evoluti insieme ai loro test UI

- Validation:
  - `npm run typecheck` OK
  - `npm test -- --run src/components/atomic-crm/dashboard/DashboardHistorical.ui.test.tsx src/components/atomic-crm/dashboard/DashboardHistoricalWidgets.test.tsx src/components/atomic-crm/dashboard/dashboardHistoryModel.test.ts` OK

- Next action:
  - nessun blocco tecnico aperto sul v1 storico
  - fare commit/push di questa chiusura quando vuoi consolidarla
  - in seguito, solo polish AI card o nuove capability richieste

### Sessione 26 (2026-02-28, browser smoke evidence)

- Completed:
  - **Browser smoke test raccolto**: screenshot del runtime reale confermano
    che `Storico` renderizza KPI, grafici, top client e contesto dati
  - **Card AI verificata in UI**: `Analisi AI dello storico` genera e mostra un
    output nel browser con badge modello `gpt-5.2`
  - **Semantica confermata in pagina**:
    - storico su due anni chiusi `2024-2025`
    - `2026` mostrato come `YTD`
    - `YoY` mostrato come `2025 vs 2024`
  - **Docs di continuità riallineati**: handoff/backlog/progress aggiornati per
    segnare chiuso anche il click-test browser

- Decisions:
  - Il primo flusso AI storico si considera verificato anche lato browser, non
    più solo lato remoto/server
  - Il prossimo step reale diventa la copertura test UI
  - L'eventuale refine della card AI è solo di leggibilità, non di logica

- Notes:
  - Dalla resa attuale non emergono errori semantici
  - L'unico spazio di miglioramento visibile è la leggibilità del markdown
    generato, se si vuole una card più compatta o più scansionabile

- Next action:
  - aggiungere test UI per empty/error/N-D/subtitle states
  - solo dopo valutare un piccolo polish di prompt/rendering markdown

### Sessione 25 (2026-02-28, remote AI smoke closure)

- Completed:
  - **Smoke test remoto AI chiuso**: verificato end-to-end `historical_analytics_summary`
    con utente autenticato temporaneo sul progetto `qvdmzhyzpyaveniirsmo`
  - **Auth runtime fix confermato**: il fallback
    `SB_PUBLISHABLE_KEY -> SUPABASE_ANON_KEY` in
    `supabase/functions/_shared/authentication.ts` ha eliminato il `401 Error:
    supabaseKey is required`
  - **Secrets remoti riallineati**: impostati esplicitamente
    `OPENAI_API_KEY` e `SB_PUBLISHABLE_KEY` sul progetto remoto
  - **Output OpenAI verificato**:
    - status `200 OK`
    - model `gpt-5.2`
    - summary coerente con `2026 YTD` e `2025 vs 2024`
  - **Docs di continuità aggiornati**: handoff/backlog/learnings/progress/spec
    riallineati allo stato finale della sessione

- Decisions:
  - Il lavoro infrastrutturale sul primo flusso AI storico si considera chiuso
    lato remoto/server
  - Il prossimo step non è più “far funzionare la function”, ma verificare il
    click-path browser e poi aggiungere test UI
  - La continuità tra chat va mantenuta aggiornando sempre handoff/backlog/spec
    quando cambiano stato remoto, secret o verifiche runtime

- Validation:
  - `npx supabase secrets list --project-ref qvdmzhyzpyaveniirsmo` OK
  - `npx supabase secrets set OPENAI_API_KEY ... SB_PUBLISHABLE_KEY ... --project-ref qvdmzhyzpyaveniirsmo` OK
  - authenticated remote smoke of `historical_analytics_summary` OK

- Notes:
  - La prima invocazione remota ha rivelato due problemi ambientali reali:
    secret `SB_PUBLISHABLE_KEY` mancante nel runtime Edge e `OPENAI_API_KEY`
    non presente sul progetto remoto
  - Entrambi i problemi sono stati corretti nella stessa sessione e il re-test
    finale è passato
  - Non è stato eseguito un click-test browser autenticato in questa
    environment
  - Questo punto va trattato come baseline stabile di rollback: dopo il push,
    se un'evoluzione successiva rompe il flusso storico AI, bisogna tornare a
    questo commit

- Next action:
  - aprire l'app autenticata e cliccare `Storico -> Genera analisi`
  - poi aggiungere test UI per empty/error/N-D/subtitle states
  - solo dopo valutare eventuale refine del prompt o UX conversazionale

### Sessione 24 (2026-02-28, OpenAI summary flow)

- Completed:
  - **Configurazione AI**: aggiunta sezione `AI` in Impostazioni con dropdown
    modello e default `gpt-5.2`
  - **Consumer UI reale**: aggiunta card `Analisi AI dello storico` dentro il
    dashboard `Storico`, con generazione manuale su click
  - **Provider methods**:
    - `getHistoricalAnalyticsContext()`
    - `generateHistoricalAnalyticsSummary()`
  - **Edge Function OpenAI**: creata `historical_analytics_summary` usando SDK
    ufficiale OpenAI e `responses.create`
  - **Deploy remoto**:
    - secret `OPENAI_API_KEY` impostato sul progetto remoto
    - function `historical_analytics_summary` deployata su
      `qvdmzhyzpyaveniirsmo`
  - **Docs di continuità aggiornati**: handoff/backlog/learnings/progress
    riallineati al nuovo stato

- Decisions:
  - L'uso di OpenAI resta server-side tramite Edge Function, non client-side
  - Il primo flusso AI e manuale e non chat-based, per controllare costi e
    qualità dell'output
  - La scelta modello e configurabile da Settings ma limitata a una whitelist

- Files created:
  - `src/lib/analytics/historicalAnalysis.ts`
  - `src/components/atomic-crm/settings/AISettingsSection.tsx`
  - `src/components/atomic-crm/dashboard/DashboardHistoricalAiSummaryCard.tsx`
  - `supabase/functions/historical_analytics_summary/index.ts`

- Files modified:
  - `src/components/atomic-crm/types.ts`
  - `src/components/atomic-crm/root/ConfigurationContext.tsx`
  - `src/components/atomic-crm/root/defaultConfiguration.ts`
  - `src/components/atomic-crm/settings/SettingsPage.tsx`
  - `src/components/atomic-crm/providers/supabase/dataProvider.ts`
  - `src/components/atomic-crm/providers/fakerest/dataProvider.ts`
  - `src/components/atomic-crm/dashboard/DashboardHistorical.tsx`
  - `supabase/config.toml`
  - `doc/src/content/docs/developers/historical-analytics-ai-ready.mdx`
  - `docs/historical-analytics-handoff.md`
  - `docs/historical-analytics-backlog.md`
  - `learnings.md`
  - `progress.md`

- Validation:
  - `npm run typecheck` OK
  - `npm test -- --run src/components/atomic-crm/dashboard/dashboardHistoryModel.test.ts` OK
  - `npx supabase secrets set OPENAI_API_KEY ... --project-ref qvdmzhyzpyaveniirsmo` OK
  - `npx supabase functions deploy historical_analytics_summary --project-ref qvdmzhyzpyaveniirsmo` OK

- Notes:
  - In questa sessione non e stato eseguito un click-test autenticato della
    card AI dentro il browser
  - Il flusso AI attuale produce una sintesi markdown, non ancora una chat o un
    pannello conversazionale

- Next action:
  - aprire `Storico`, lanciare `Analisi AI` e verificare output reale
  - poi aggiungere test UI sugli stati storico

### Sessione 23 (2026-02-28, AI analytics entry point)

- Completed:
  - **Entry point AI aggiunto**: introdotto
    `dataProvider.getHistoricalAnalyticsContext()` come primo punto di accesso
    stabile al payload semantico storico
  - **Payload semanticamente piu forte**: `buildAnalyticsContext()` ora include
    anche `caveats` umani oltre a `meta`, `metrics`, `series` e `qualityFlags`
  - **Copertura test aggiornata**: i test sul context serializzato verificano
    anche i nuovi caveat principali
  - **Scope riallineato**: backlog/handoff aggiornati per segnare che la demo
    non e una priorita corrente

- Decisions:
  - Il primo consumer AI resta lato client/provider e non richiede ancora una
    nuova edge function
  - L'assistente futuro dovra consumare il metodo custom del provider invece di
    interrogare tabelle o view raw in autonomia
  - FakeRest/demo historical support viene rinviato finche non entra davvero
    nel perimetro prodotto

- Files modified:
  - `src/lib/analytics/buildAnalyticsContext.ts`
  - `src/components/atomic-crm/providers/supabase/dataProvider.ts`
  - `src/components/atomic-crm/providers/fakerest/dataProvider.ts`
  - `src/components/atomic-crm/dashboard/dashboardHistoryModel.test.ts`
  - `doc/src/content/docs/developers/historical-analytics-ai-ready.mdx`
  - `docs/historical-analytics-handoff.md`
  - `docs/historical-analytics-backlog.md`
  - `learnings.md`
  - `progress.md`

- Validation:
  - `npm run typecheck` OK
  - `npm test -- --run src/components/atomic-crm/dashboard/dashboardHistoryModel.test.ts` OK

- Next action:
  - scegliere il primo consumer reale del payload AI
  - poi aggiungere UI tests per gli stati storico

### Sessione 22 (2026-02-28, Remote historical verification)

- Completed:
  - **Verifica remota delle view storiche**: controllate sul progetto
    `qvdmzhyzpyaveniirsmo` via PostgREST:
    - `analytics_history_meta`
    - `analytics_yearly_competence_revenue`
    - `analytics_yearly_competence_revenue_by_category`
    - `analytics_client_lifetime_competence_revenue`
  - **Semantica confermata con dati reali**:
    - `first_year_with_data = 2024`
    - `last_year_with_data = 2025`
    - `2026` presente come riga `YTD`
    - `YoY = 2025 vs 2024 = +560%`
    - top client lifetime: `Diego Caltabiano = €23.700`
  - **Diagnosi RLS chiarita**: le stesse query con publishable/anon key
    restituiscono array vuoti non per assenza dati, ma per `security_invoker=on`
    sopra tabelle base protette da RLS
  - **Continuity docs aggiornati**: handoff/backlog/learnings riallineati al
    nuovo stato della verifica

- Decisions:
  - Considerare completata la verifica remota a livello risorse/dati, senza
    riaprire l'architettura dello storico
  - Non interpretare piu output vuoti con ruolo anonimo come prova di migration
    fallita sulle view analytics
  - Mantenere come prossimi step prioritari FakeRest/demo hardening e primo
    consumo AI del `buildAnalyticsContext`

- Files modified:
  - `docs/historical-analytics-handoff.md`
  - `docs/historical-analytics-backlog.md`
  - `learnings.md`
  - `progress.md`

- Validation:
  - query REST remote OK sulle nuove view con `service_role`
  - verifica publishable/anon OK per confermare il comportamento RLS

- Notes:
  - In questa sessione non e stato eseguito un browser smoke test completo del
    tab `Storico`; la verifica fatta e stata sul layer dati/runtime remoto
  - Il pooler Postgres remoto rimane poco affidabile per diagnostica dopo errori
    auth del temp role CLI

- Next action:
  - decidere se consolidare il gating demo/FakeRest o introdurre una capability
    check esplicita per lo storico
  - poi costruire il primo entry point AI sopra `buildAnalyticsContext`

### Sessione 21 (2026-02-28, Historical Analytics AI-Ready + push remoto)

- Completed:
  - **Spec tecnica storica**: aggiunta documentazione ufficiale con regole canoniche, viste aggregate, semantic layer e roadmap AI in `doc/src/content/docs/developers/historical-analytics-ai-ready.mdx`
  - **Viste aggregate Supabase**: creata migration `20260228133000_historical_analytics_views.sql` con:
    - `analytics_business_clock`
    - `analytics_history_meta`
    - `analytics_yearly_competence_revenue`
    - `analytics_yearly_competence_revenue_by_category`
    - `analytics_client_lifetime_competence_revenue`
  - **Provider Supabase**: registrate le primary key delle nuove view nel data provider
  - **Dashboard shell**: separato il dashboard in `Annuale` e `Storico`
  - **Vista storica desktop/mobile**: aggiunti KPI storici, grafico annuale, mix categorie, top clienti all-time e card di contesto
  - **Semantic layer AI-ready**:
    - `analyticsDefinitions.ts`
    - `buildAnalyticsContext.ts`
  - **Regole bloccate in codice**:
    - anno corrente sempre `YTD`
    - `YoY` solo sugli ultimi due anni chiusi
    - baseline `0` => `N/D`
  - **Testing**: aggiunti test unitari su `dashboardHistoryModel`
  - **Continuity docs**: creati `docs/historical-analytics-handoff.md` e `docs/historical-analytics-backlog.md`
  - **Push remoto completato**: `npx supabase db push` eseguito con successo sul progetto collegato `qvdmzhyzpyaveniirsmo`

- Decisions:
  - La base semantica v1 dello storico è `compensi per competenza`, non `incassi`
  - Il dashboard storico non deve mescolare alert operativi e logica fiscale forward-looking
  - Le sessioni future devono ripartire leggendo handoff + backlog + spec, non dalla sola chat
  - La verifica runtime successiva va fatta sul remoto, non su locale, perché in questo ambiente non esiste un DB locale funzionante

- Files created:
  - `doc/src/content/docs/developers/historical-analytics-ai-ready.mdx`
  - `supabase/migrations/20260228133000_historical_analytics_views.sql`
  - `src/components/atomic-crm/dashboard/DashboardAnnual.tsx`
  - `src/components/atomic-crm/dashboard/DashboardHistorical.tsx`
  - `src/components/atomic-crm/dashboard/DashboardHistoricalKpis.tsx`
  - `src/components/atomic-crm/dashboard/DashboardHistoricalRevenueChart.tsx`
  - `src/components/atomic-crm/dashboard/DashboardHistoricalCategoryMixChart.tsx`
  - `src/components/atomic-crm/dashboard/DashboardHistoricalTopClientsCard.tsx`
  - `src/components/atomic-crm/dashboard/dashboardHistoryModel.ts`
  - `src/components/atomic-crm/dashboard/dashboardHistoryModel.test.ts`
  - `src/components/atomic-crm/dashboard/useHistoricalDashboardData.ts`
  - `src/lib/analytics/analyticsDefinitions.ts`
  - `src/lib/analytics/buildAnalyticsContext.ts`
  - `docs/historical-analytics-handoff.md`
  - `docs/historical-analytics-backlog.md`

- Files modified:
  - `src/components/atomic-crm/dashboard/Dashboard.tsx`
  - `src/components/atomic-crm/dashboard/MobileDashboard.tsx`
  - `src/components/atomic-crm/providers/supabase/dataProvider.ts`

- Validation:
  - `npm run typecheck` OK
  - `npm test -- --run src/components/atomic-crm/dashboard/dashboardHistoryModel.test.ts` OK
  - `npx supabase db push` OK su remoto

- Notes:
  - `npx supabase migration list --linked` non è stato affidabile per auth del temp role
  - `npx supabase db push --dry-run` ha mostrato correttamente la migration pendente prima del push
  - dopo alcuni tentativi auth il pooler remoto ha aperto un circuit breaker sul temp role CLI; non usare questo come indicatore del fallimento del push reale se il comando `db push` ha già confermato l'applicazione

- Next action:
  - aprire l'app contro il remoto e validare davvero la vista `Storico`
  - poi iniziare il primo flusso AI sopra `buildAnalyticsContext`

### Sessione 20 (2026-02-28, Accessibilita form e warning dashboard)

- Completed:
  - **`SelectInput` label-safe**: corretto il collegamento `FormLabel` -> controllo reale nei select custom, eliminando issue Chrome su `label for=FORM_ELEMENT`
  - **`AutocompleteInput` e `AutocompleteArrayInput` accessibili**: aggiunti `id` e `name` all'elemento interattivo reale dei campi basati su `Popover`/`Command`
  - **Verifica promemoria**: creazione di un promemoria con cliente eseguita manualmente con esito positivo
  - **Dashboard ripulita**: eliminato il warning Recharts `width(-1) and height(-1)` nei grafici con `ResponsiveContainer`
  - **Verifica runtime dashboard**: controllo manuale confermato, warning sparito e grafici visibili correttamente

- Decisions:
  - Nei componenti form composti, `id`/`name` devono finire sul `button` o `input` che riceve focus, non su wrapper `div` o contenitori `Popover`
  - Per i grafici dashboard con altezza nota, usare `ResponsiveContainer` con altezza numerica diretta invece di `height="100%"` annidato in un wrapper fisso
  - Tenere separati i fix di accessibilita form dai fix dashboard per facilitare audit e revert

- Files modified:
  - `src/components/admin/select-input.tsx`
  - `src/components/admin/autocomplete-input.tsx`
  - `src/components/admin/autocomplete-array-input.tsx`
  - `src/components/atomic-crm/dashboard/DashboardRevenueTrendChart.tsx`
  - `src/components/atomic-crm/dashboard/DashboardCategoryChart.tsx`
  - `src/components/atomic-crm/dashboard/DashboardPipelineCard.tsx`

- Commits:
  - `74b38b3` `fix: align select labels with form controls`
  - `b874139` `fix: connect autocomplete fields to form labels`
  - `ff93cca` `fix: stabilize dashboard chart sizing`

- Next action: Push dei commit e smoke test trasversale sui form che usano `AutocompleteInput`

### Sessione 19 (2026-02-28, Stabilizzazione runtime e documentazione)

- Completed:
  - **Filtro periodo riusabile**: estratto `DateRangeFilter.tsx` per sidebar filtri di spese, pagamenti, progetti e servizi
  - **Filtri data estesi**: aggiunti range date a Progetti, Preventivi e vista attività dashboard
  - **Tooling repo pulita**: normalizzazione Prettier repo-wide, migrazione ignore dentro `eslint.config.js`, `make lint` tornato verde
  - **Vitest future-proof**: aggiunti `await` alle `expect(...).resolves` in `supabaseAdapter.spec.ts`
  - **Bug 406 su Spese/Pagamenti/Preventivi**: corretta la firma `useGetOne(resource, params, options)` per relazioni opzionali; eliminati fetch con id vuoto verso Supabase
  - **Verifica runtime**: test verdi, build OK, smoke check frontend OK, verifica manuale pagina Spese con record con/senza progetto OK
  - **Warning React nel registro lavori**: corretto `SelectInput` del campo `service_type` per leggere `label/value` invece dei default `name/id`
  - **Documentazione aggiornata**: README + docs developer allineate a lint/test, registry hook e convenzioni dei date range filter

- Decisions:
  - Tenere separati i commit di feature, cleanup tooling, fix runtime e docs per rendere semplice l'eventuale revert
  - Considerare `406 Not Acceptable` su `getOne` come segnale di `id` nullo/vuoto prima di ipotizzare problemi DB
  - Per tutte le liste/config basate su `LabeledValue`, dichiarare `optionText="label"` e `optionValue="value"` quando si usa `SelectInput`

- Files created:
  - `src/components/atomic-crm/filters/DateRangeFilter.tsx`

- Files modified:
  - `src/components/atomic-crm/expenses/ExpenseListFilter.tsx`
  - `src/components/atomic-crm/payments/PaymentListFilter.tsx`
  - `src/components/atomic-crm/projects/ProjectListFilter.tsx`
  - `src/components/atomic-crm/services/ServiceListFilter.tsx`
  - `src/components/atomic-crm/quotes/QuoteList.tsx`
  - `src/components/atomic-crm/tasks/TasksListContent.tsx`
  - `src/components/atomic-crm/providers/fakerest/internal/supabaseAdapter.spec.ts`
  - `src/components/atomic-crm/expenses/ExpenseListContent.tsx`
  - `src/components/atomic-crm/expenses/ExpenseShow.tsx`
  - `src/components/atomic-crm/payments/PaymentListContent.tsx`
  - `src/components/atomic-crm/payments/PaymentShow.tsx`
  - `src/components/atomic-crm/quotes/QuoteCard.tsx`
  - `src/components/atomic-crm/quotes/QuoteShow.tsx`
  - `src/components/atomic-crm/services/ServiceInputs.tsx`
  - `README.md`
  - `doc/src/content/docs/developers/architecture-choices.mdx`
  - `doc/src/content/docs/developers/data-providers.mdx`
  - `eslint.config.js`

- Commits:
  - `3d6d8af` `feat: unify date range filters across CRM lists`
  - `fe23ada` `chore: update registry for date range filter`
  - `e74a7f9` `chore: normalize formatting and lint config`
  - `4cf6127` `test: await async expectations in supabase adapter specs`
  - `8e31ee5` `fix: prevent invalid getOne requests for optional relations`
  - `e450b18` `docs: update tooling and filter guidance`
  - `4aca90e` `fix: use labeled values in service type select`

- Next action: Push dei commit e smoke test trasversale su Preventivi/Pagamenti dopo deploy

### Sessione 18 (2026-02-28, Navigazione per anno + Colori Dashboard)

- Completed:
  - **Year selector UI**: chevron `← 2025 →` con freccia destra disabilitata su anno corrente
  - **dashboardModel.ts**: parametro `year?` con validazione (2000–anno corrente, fallback), `selectedYear` e `isCurrentYear` nel DashboardModel, revenue trend adattato (gen-dic per anni passati vs rolling 12 per anno corrente)
  - **fiscalModel.ts**: parametro `year?` con stessa validazione, `monthsOfData = 12` per anni passati, aliquota calcolata su anno selezionato
  - **useDashboardData.ts**: accetta `year?`, lo passa a buildDashboardModel, aggiunto alle deps useMemo
  - **Dashboard.tsx**: state `selectedYear`, YearSelector component, visibilità condizionale per anni passati
  - **DashboardFiscalKpis.tsx**: label dinamiche ("Stima" → termine definitivo per anni passati), badge "Consuntivo anno completo"
  - **Filtro per anno**: pagamenti filtrati per `payment_date` (fallback `created_at`), preventivi per `created_at`, pipeline per anno
  - **Nascosti per anni passati**: DeadlinesCard, BusinessHealthCard, warnings fiscali, alerts card
  - **Sempre visibili**: KPI (filtrati per anno), revenue trend, categorie, top clienti, pipeline, FiscalKpis, AtecoChart
  - **Titolo dinamico**: "Fiscale & Salute Aziendale" (corrente) vs "Riepilogo Fiscale 2025" (passato)
  - **Error handling**: validazione anno (>= 2000, <= anno corrente), Number.isFinite check, freccia destra disabilitata
  - **Verifica**: Typecheck 0 errori, build OK, 42/42 test passati
  - **Colori semantici dashboard**: Badge success (verde) e warning (ambra) aggiunti a badge.tsx; Progress con prop variant (success/warning/destructive)
  - **KPI trend positivo**: badge verde (era grigio)
  - **Alert "In scadenza"**: badge ambra (era grigio) — triade ambra→rosso→outline
  - **Tetto forfettario**: progress bar verde < 70%, ambra 70-90%, rosso > 90% (desktop + mobile)
  - **Badge % netto**: verde se ≥ 60%
  - **BusinessHealth "Ottimo"/"Sano"**: badge verde (era blu generico)

- Files modified:
  - `src/components/atomic-crm/dashboard/dashboardModel.ts` (year param, selectedYear, isCurrentYear, referenceDate, filtro pagamenti/preventivi per anno)
  - `src/components/atomic-crm/dashboard/fiscalModel.ts` (year param, monthsOfData condizionale)
  - `src/components/atomic-crm/dashboard/useDashboardData.ts` (year param passthrough)
  - `src/components/atomic-crm/dashboard/Dashboard.tsx` (YearSelector, state, visibilità condizionale)
  - `src/components/atomic-crm/dashboard/DashboardFiscalKpis.tsx` (isCurrentYear prop, label dinamiche, colori tetto + badge netto)
  - `src/components/atomic-crm/dashboard/DashboardAlertsCard.tsx` (due_soon warning badge)
  - `src/components/atomic-crm/dashboard/DashboardBusinessHealthCard.tsx` (badge success per stati positivi)
  - `src/components/atomic-crm/dashboard/DashboardKpiCards.tsx` (trend positivo success badge)
  - `src/components/atomic-crm/dashboard/MobileDashboard.tsx` (progress bar tetto colorata)
  - `src/components/ui/badge.tsx` (varianti success + warning)
  - `src/components/ui/progress.tsx` (prop variant con CVA)

- Decisions:
  - Per anni passati nascondere completamente (non avvisi) i componenti forward-looking
  - Filtrare pagamenti e preventivi per anno (non mostrare dati globali)
  - Alerts nascosti per anni passati (operativi solo per anno corrente)
  - Pagamenti non ricevuti di anni passati restano visibili solo nell'anno di appartenenza (crediti persi = dato storico)
  - MobileDashboard non impattata (sempre anno corrente)

- Next action: Test visivo completo, deploy Vercel

### Sessione 17 (2026-02-28, Simulatore Fiscale)

- Completed:
  - **Tipi fiscali**: `FiscalTaxProfile` + `FiscalConfig` in types.ts
  - **ConfigurationContext**: aggiunto `fiscalConfig` con default (ATECO 731102 78%, 621000 67%)
  - **Settings UI**: nuova sezione "Fiscale" in Impostazioni con profili ATECO, aliquota auto, INPS, tetto
  - **Modello fiscale** (`fiscalModel.ts`): logica pura (KPI, ATECO breakdown, scadenze, business health, warnings)
  - **Dashboard desktop**: 4 nuovi componenti (FiscalKpis, AtecoChart, DeadlinesCard, BusinessHealthCard)
  - **Dashboard mobile**: 3 KPI compatti (accantonamento, prossima scadenza, tetto)
  - **Data integration**: query expenses + fiscalConfig integrati nel dashboard model
  - **Verifica**: Typecheck 0 errori, build OK (6.09s), 42/42 test passati

- Files created:
  - `src/components/atomic-crm/settings/FiscalSettingsSection.tsx`
  - `src/components/atomic-crm/dashboard/fiscalModel.ts`
  - `src/components/atomic-crm/dashboard/DashboardFiscalKpis.tsx`
  - `src/components/atomic-crm/dashboard/DashboardAtecoChart.tsx`
  - `src/components/atomic-crm/dashboard/DashboardDeadlinesCard.tsx`
  - `src/components/atomic-crm/dashboard/DashboardBusinessHealthCard.tsx`

- Files modified:
  - types.ts, ConfigurationContext.tsx, defaultConfiguration.ts, SettingsPage.tsx
  - dashboardModel.ts, useDashboardData.ts, Dashboard.tsx, MobileDashboard.tsx

- Next action: Test visivo completo, deploy Vercel

### Sessione 16 (2026-02-28, DateTime Range Support)

- Completed:
  - **DB Migration**: `20260228120000_datetime_range_support.sql`
    - quotes: event_date → event_start (TIMESTAMPTZ) + event_end (TIMESTAMPTZ) + all_day (BOOLEAN DEFAULT true)
    - projects: start_date/end_date convertiti a TIMESTAMPTZ + all_day aggiunto; CHECK constraint droppato e ricreato
    - services: service_date → TIMESTAMPTZ + service_end (TIMESTAMPTZ) + all_day (BOOLEAN DEFAULT true)
    - client_tasks: all_day (BOOLEAN DEFAULT true) aggiunto
  - **Utility condivise**: `src/components/atomic-crm/misc/formatDateRange.ts`
    - `formatDateRange(start, end, allDay)` — per liste/card (dd/MM/yyyy o dd/MM/yyyy HH:mm)
    - `formatDateLong(start, end, allDay)` — per PDF (formato lungo italiano con date-fns locale)
  - **Types + i18n**: Aggiornati `types.ts` e `i18nProvider.tsx` per tutti i moduli
  - **Preventivi** (5 file): QuoteInputs (BooleanInput + DateComponent condizionale), QuoteCard (formatDateRange), QuoteShow, QuotePDF (formatDateLong), QuoteList (exporter CSV aggiornato)
  - **Servizi** (4 file): ServiceInputs (BooleanInput + service_end), ServiceShow, ServiceListContent, ServiceList (exporter CSV)
  - **Progetti** (4 file): ProjectInputs (BooleanInput + DateComponent condizionale), ProjectShow (periodo combinato), ProjectListContent ("Periodo" con formatDateRange), ProjectList (exporter CSV)
  - **Promemoria** (3 file): TaskFormContent (BooleanInput + DateComponent), TaskCreateSheet (default all_day + transform), Task (formatDateRange + postponeDate helper)
  - **Verifica**: Typecheck 0 errori, build OK (6.27s), 42/42 test passati

- Decisions:
  - Pattern Google Calendar: all_day=true → DateInput (solo data), all_day=false → DateTimeInput (data+ora)
  - DATE → TIMESTAMPTZ migration sicura (DATE_TRUNC funziona identicamente, PostgREST accetta YYYY-MM-DD)
  - CHECK constraint: DROP → ALTER TYPE → RECREATE (pattern sicuro per cambio tipo colonna)
  - postponeDate preserva il time component quando all_day=false
  - Colonna "Periodo" nei progetti unifica start_date + end_date in una sola cella con formatDateRange

- Migration created:
  - `supabase/migrations/20260228120000_datetime_range_support.sql`

- Files created:
  - `src/components/atomic-crm/misc/formatDateRange.ts`

- Files modified:
  - `src/components/atomic-crm/types.ts` (Quote: +event_start/event_end/all_day, Project: +all_day, Service: +service_end/all_day, ClientTask: +all_day)
  - `src/components/atomic-crm/root/i18nProvider.tsx` (labels per nuovi campi)
  - `src/components/atomic-crm/quotes/QuoteInputs.tsx` (BooleanInput + DateComponent)
  - `src/components/atomic-crm/quotes/QuoteCard.tsx` (formatDateRange)
  - `src/components/atomic-crm/quotes/QuoteShow.tsx` (formatDateRange)
  - `src/components/atomic-crm/quotes/QuotePDF.tsx` (formatDateLong)
  - `src/components/atomic-crm/quotes/QuoteList.tsx` (exporter CSV)
  - `src/components/atomic-crm/services/ServiceInputs.tsx` (BooleanInput + service_end)
  - `src/components/atomic-crm/services/ServiceShow.tsx` (formatDateRange)
  - `src/components/atomic-crm/services/ServiceListContent.tsx` (formatDateRange)
  - `src/components/atomic-crm/services/ServiceList.tsx` (exporter CSV)
  - `src/components/atomic-crm/projects/ProjectInputs.tsx` (BooleanInput + DateComponent)
  - `src/components/atomic-crm/projects/ProjectShow.tsx` (formatDateRange, "Periodo" combinato)
  - `src/components/atomic-crm/projects/ProjectListContent.tsx` (formatDateRange, "Periodo")
  - `src/components/atomic-crm/projects/ProjectList.tsx` (exporter CSV)
  - `src/components/atomic-crm/tasks/TaskFormContent.tsx` (BooleanInput + DateComponent)
  - `src/components/atomic-crm/tasks/TaskCreateSheet.tsx` (default all_day + transform)
  - `src/components/atomic-crm/tasks/Task.tsx` (formatDateRange + postponeDate)

- Continued (bug fix audit):
  - **Migration fix**: DROP VIEW monthly_revenue + project_financials prima di ALTER TYPE service_date, poi RECREATE
  - **Migration pushata** al DB remoto con successo
  - **Validazione date range** aggiunta: event_end >= event_start (QuoteInputs), service_end >= service_date (ServiceInputs)
  - **Default all_day mancanti**: aggiunti a ProjectCreate, ServiceCreate, QuoteCreate, AddTask
  - **AddTask transform**: ora condizionale su all_day (non forza mezzanotte se all_day=false)
  - **Dashboard UpcomingServiceAlert**: aggiunto serviceEnd + allDay al tipo e al builder, DashboardAlertsCard usa formatDateRange quando allDay=false

- Next action: Test visivo completo, deploy Vercel

### Sessione 15 (2026-02-28, tipi servizio configurabili)

- Completed:
  - **Fix dialog preventivi**: NumberInput controlled/uncontrolled warning (destructured defaultValue), DialogTitle/DialogDescription mancanti su QuoteCreate, QuoteShow, QuoteEdit
  - **CHECK constraint quotes.service_type**: Migration `20260227230519_add_quotes_service_type_check.sql` (poi droppata — vedi sotto)
  - **Tipi servizio editabili da Impostazioni**:
    - ConfigurationContext: aggiunti `quoteServiceTypes` e `serviceTypeChoices` (LabeledValue[])
    - defaultConfiguration: valori default con nuovi tipi (produzione_tv, videoclip, documentario, spot, sito_web)
    - SettingsPage: 2 nuove sezioni "Tipi preventivo" e "Tipi servizio" con ArrayInput editabili
    - 10 componenti aggiornati per leggere da config invece che da costanti hardcoded:
      - Preventivi: QuoteInputs, QuoteCard, QuoteShow, QuoteList (exporter incluso)
      - Servizi: ServiceInputs, ServiceList (exporter incluso), ServiceShow, ServiceListContent, ServiceListFilter
    - Pulizia: rimossi export dead code da quotesTypes.ts, svuotato serviceTypes.ts
    - DB: droppati CHECK constraint su quotes.service_type e services.service_type (migration `20260227231714_drop_service_type_checks.sql`)

- Decisions:
  - Tipi preventivo e tipi servizio sono due liste separate (concettualmente diversi: tipo evento vs tipo lavoro tecnico)
  - Formato LabeledValue { value, label } per coerenza con ConfigurationContext (non { id, name })
  - ensureValues() auto-genera slug value dal label se mancante
  - CHECK constraint incompatibili con tipi dinamici — rimossi entrambi
  - Exporter CSV spostati dentro il componente per accedere alla config via hook

- Migrations created:
  - `supabase/migrations/20260227230519_add_quotes_service_type_check.sql` (aggiunto e poi droppato)
  - `supabase/migrations/20260227231714_drop_service_type_checks.sql`

- Files modified:
  - `src/components/admin/number-input.tsx` (fix defaultValue passthrough)
  - `src/components/atomic-crm/root/ConfigurationContext.tsx` (+ quoteServiceTypes, serviceTypeChoices)
  - `src/components/atomic-crm/root/defaultConfiguration.ts` (+ defaults con nuovi tipi)
  - `src/components/atomic-crm/settings/SettingsPage.tsx` (+ 2 sezioni editabili)
  - `src/components/atomic-crm/quotes/QuoteCreate.tsx` (+ DialogTitle/DialogDescription)
  - `src/components/atomic-crm/quotes/QuoteEdit.tsx` (+ DialogDescription)
  - `src/components/atomic-crm/quotes/QuoteShow.tsx` (+ DialogTitle/DialogDescription, config)
  - `src/components/atomic-crm/quotes/QuoteInputs.tsx` (config)
  - `src/components/atomic-crm/quotes/QuoteCard.tsx` (config)
  - `src/components/atomic-crm/quotes/QuoteList.tsx` (config, exporter inside component)
  - `src/components/atomic-crm/quotes/quotesTypes.ts` (rimossi quoteServiceTypes/quoteServiceTypeLabels)
  - `src/components/atomic-crm/services/ServiceInputs.tsx` (config)
  - `src/components/atomic-crm/services/ServiceList.tsx` (config, exporter inside component)
  - `src/components/atomic-crm/services/ServiceShow.tsx` (config)
  - `src/components/atomic-crm/services/ServiceListContent.tsx` (config)
  - `src/components/atomic-crm/services/ServiceListFilter.tsx` (config, type.id→type.value)
  - `src/components/atomic-crm/services/serviceTypes.ts` (svuotato, placeholder)

- Next action: Test visivo completo, deploy Vercel

### Sessione 14 (2026-02-28, audit robustezza)

- In progress:
  - **Audit robustezza** — 19 problemi identificati in audit.md (7 P0, 6 P1, 4 P2)
  - **A1 + B1: Duplicati clienti** — UNIQUE constraint DB su `clients.name` + validazione async frontend (query pre-save con esclusione record corrente in edit)
  - **A2 + B2: Importi negativi + crediti + rimborsi**:
    - CHECK >= 0 su tutte le colonne numeriche (services, payments, expenses, quotes)
    - `minValue(0)` di ra-core su tutti i NumberInput (4 file Inputs)
    - Nuovo tipo spesa `credito_ricevuto` (bene/sconto ricevuto dal cliente, riduce spese)
    - Nuovo tipo pagamento `rimborso` (rimborso al cliente, riduce il pagato)
    - Migration: iPhone da amount=-500 → amount=+500, type=credito_ricevuto
    - View `project_financials` aggiornata: crediti sottratti dalle spese, rimborsi sottratti dal pagato
    - `computeTotal` aggiornato in 3 file (ExpenseListContent, ExpenseShow, ExpenseList)
    - `ClientFinancialSummary` aggiornato per crediti e rimborsi
    - `dashboardModel.ts` aggiornato: rimborsi esclusi dai pending alerts
    - Descrizioni tipi aggiunte (expenseTypeDescriptions, paymentTypeDescriptions)
    - Sezione CreditSection nel form spese (solo campo amount con helperText)

- Decisions:
  - Il segno è determinato dal TIPO, non dal valore: importi sempre >= 0
  - `credito_ricevuto` per spese (iPhone, sconti, barter): valore positivo, sistema sottrae
  - `rimborso` per pagamenti: importo positivo, sistema sottrae dal total_paid
  - Duplicati clienti: DB UNIQUE + frontend check (scelta utente: entrambi)
  - Descrizioni mini per tipi spesa/pagamento: basate su funzionamento reale sistema

- Migration created:
  - `supabase/migrations/20260228000000_audit_constraints.sql` (UNIQUE, CHECK, tipi nuovi, iPhone migration, view aggiornata)

- Files modified:
  - `src/components/atomic-crm/clients/ClientInputs.tsx` (validazione unique name)
  - `src/components/atomic-crm/services/ServiceInputs.tsx` (minValue su 6 campi)
  - `src/components/atomic-crm/payments/PaymentInputs.tsx` (minValue su amount)
  - `src/components/atomic-crm/expenses/ExpenseInputs.tsx` (minValue + CreditSection)
  - `src/components/atomic-crm/quotes/QuoteInputs.tsx` (minValue su amount)
  - `src/components/atomic-crm/expenses/expenseTypes.ts` (credito_ricevuto + descriptions)
  - `src/components/atomic-crm/payments/paymentTypes.ts` (rimborso + descriptions)
  - `src/components/atomic-crm/expenses/ExpenseListContent.tsx` (computeTotal per crediti)
  - `src/components/atomic-crm/expenses/ExpenseShow.tsx` (computeTotal + CreditSection view)
  - `src/components/atomic-crm/expenses/ExpenseList.tsx` (computeTotal export)
  - `src/components/atomic-crm/clients/ClientFinancialSummary.tsx` (crediti e rimborsi)
  - `src/components/atomic-crm/dashboard/dashboardModel.ts` (rimborsi esclusi da pending)

- Continued (same session):
  - **A3 + B3: payment_date obbligatoria**:
    - Frontend: `validate={required()}` su DateInput in PaymentInputs.tsx
    - DB: Migration `20260227220805_payment_date_not_null.sql` — safety fill NULL→created_at + ALTER COLUMN SET NOT NULL
    - Migration pushata al DB remoto
  - **Ricerca descrizione nelle Spese**: Campo di ricerca `description@ilike` nella sidebar filtri ExpenseListFilter (stesso pattern di ServiceListFilter per località)
  - **Tooltip descrizioni tipi**: `optionText` come funzione con `<span title={...}>` su SelectInput tipo in ExpenseInputs e PaymentInputs — mostra descrizione al passaggio del mouse
  - iPhone dissociato dal progetto "Borghi Marinari" (scelta utente) — credito generico a livello cliente, non progetto-specifico

- Decisions (continued):
  - payment_date sempre obbligatoria (nessuna eccezione)
  - Tooltip nativi browser (`title` attr) per descrizioni tipi — approccio minimale senza componenti extra
  - Crediti senza project_id: esclusi da project_financials view (WHERE project_id IS NOT NULL), inclusi in ClientFinancialSummary (filtra per client_id)
  - Dashboard non usa expenses — KPI non impattati da crediti/rimborsi

- Migrations created (continued):
  - `supabase/migrations/20260227220805_payment_date_not_null.sql`

- Files modified (continued):
  - `src/components/atomic-crm/payments/PaymentInputs.tsx` (required payment_date + tooltip tipo)
  - `src/components/atomic-crm/expenses/ExpenseInputs.tsx` (tooltip tipo)
  - `src/components/atomic-crm/expenses/ExpenseListFilter.tsx` (campo ricerca descrizione)

- Continued (same session, second part):
  - **Filtri coerenti Pagamenti/Spese**: Client dropdown + date range filter aggiunti a PaymentListFilter e ExpenseListFilter; project colonna aggiunta a export CSV di entrambi
  - **A4: Motivo rifiuto required quando status=rifiutato**:
    - Frontend: `validate={required()}` su rejection_reason in QuoteInputs
    - DB: CHECK constraint `status != 'rifiutato' OR rejection_reason IS NOT NULL`
    - Kanban: drag verso colonna "Rifiutato" bloccato — editing obbligatorio per compilare motivo
  - **A5 + B8: Date incoerenti**:
    - DB: CHECK `end_date >= start_date` su projects, `response_date >= sent_date` su quotes (tollerano NULL)
    - Frontend: validatore inline su end_date e response_date
  - **A6: Date preventivo condizionali per status**:
    - Frontend: `sent_date` required se status ≠ primo_contatto; `response_date` required per accettato/rifiutato/successivi
    - Solo frontend (no DB CHECK per compatibilità Kanban drag-and-drop)
  - **A7: Tag name non vuoto**: early return + button disabled se `newTagName.trim()` vuoto in TagDialog
  - **B4: updated_at su services, payments, expenses**: Migration con ADD COLUMN + trigger `set_updated_at()`
  - **B6: UNIQUE (client_id, name) su projects**: Migration con UNIQUE constraint
  - **C1 + C2: Error handling liste e show pages**:
    - Creato `misc/ErrorMessage.tsx` (componente riutilizzabile con AlertCircle)
    - Aggiunto `if (error) return <ErrorMessage />` a 4 ListContent + 5 Show pages
  - **Typecheck 0 errori, build OK**

- Decisions (second part):
  - Dashboard come early warning per pagamenti scaduti — niente auto-update DB status (utente decide manualmente)
  - Kanban drag verso "Rifiutato" bloccato per coerenza con DB constraint rejection_reason
  - Date condizionali solo frontend (sent_date, response_date) per compatibilità drag-and-drop
  - ErrorMessage come componente condiviso in misc/ anziché duplicato in ogni file

- Migrations created (second part):
  - `20260227223414_quote_rejection_reason_required.sql`
  - `20260227224137_date_range_checks.sql`
  - `20260227224448_add_updated_at_columns.sql`
  - `20260227224515_unique_project_client_name.sql`

- Next action: Test visivo completo, deploy Vercel

### Sessione 13 (2026-02-27, sera)

- Completed:
  - **Deploy su Vercel** — Build OK, push a GitHub, deploy automatico
  - **Separazione workflow episodi/pagamenti** — QuickEpisodeDialog semplificato (solo servizio), QuickPaymentDialog nuovo (pagamento a livello progetto)
  - **Smart payment amounts** — Auto-fill importo in base al tipo: acconto=compensi, saldo=residuo, rimborso=totale spese
  - **Expenses nella view project_financials** — Migration `20260227230000_add_expenses_to_project_financials.sql`: aggiunge total_expenses da tabella expenses (km + materiale + noleggio con markup)
  - **Alert pagamenti intelligenti** — Dashboard mostra TUTTI i pagamenti pending con urgency (overdue/due_soon/pending), non solo finestra 7 giorni
  - **Progetto e note negli alert** — PaymentAlert esteso con projectName e notes per identificare i pagamenti
  - **Filtro cliente nella lista progetti** — Dropdown select con tutti i clienti (non badge, meglio UX con molti clienti)
  - **Fix ricerca progetti** — Campo "Cerca progetto" convertito da `q` (FTS, non funzionante) a `name@ilike` con wildcards
  - **Riallocazione COMPLETA pagamenti Diego** — Migration `20260227205707_reallocate_diego_payments.sql`:
    - Incrociati fogli CSV + fatture XML + DB per trovare allocazione corretta
    - DELETE 10 pagamenti errati, CREATE 11 corretti
    - Foglio 1: GS €6.761,59 + BTF €4.207,71 + 6 Spot €1.437,89 = €12.407,19
    - Foglio 2: GS €1.360,25 + BTF €1.322,10 + BM €7.152,10 = €9.834,45
    - Tutti gli spot a balance 0, GS a 0, BM a 0, Nisseno a 0
    - BTF mostra €669,60 = pending non fatturato, VIV mostra €389 = in attesa
    - Totale ricevuto invariato: €23.985,64

- Decisions:
  - Workflow pagamenti: separato da episodi, a livello progetto (non per singolo servizio)
  - Rimosso "parziale" come tipo pagamento (ridondante con acconto)
  - Rimosso "scaduto" dal dialog pagamento (auto-determinato dal sistema)
  - DROP VIEW + CREATE VIEW quando l'ordine colonne cambia (non CREATE OR REPLACE)
  - Fogli contabili CSV come fonte di verità per allocazione pagamenti
  - Km allocati proporzionalmente ai progetti basandosi sui dati foglio
  - Spese km NON fatturate al cliente (confermato dalle fatture XML)
  - Dropdown per filtro clienti (non badge) — scalabilità UX

- Migrations created:
  - `supabase/migrations/20260227230000_add_expenses_to_project_financials.sql`
  - `supabase/migrations/20260227205707_reallocate_diego_payments.sql`

- Files created:
  - `src/components/atomic-crm/projects/QuickPaymentDialog.tsx`

- Files modified:
  - `src/components/atomic-crm/projects/QuickEpisodeForm.tsx` (semplificato)
  - `src/components/atomic-crm/projects/QuickEpisodeDialog.tsx` (semplificato)
  - `src/components/atomic-crm/projects/ProjectShow.tsx` (+ QuickPaymentDialog, financials aggiornati)
  - `src/components/atomic-crm/projects/ProjectListFilter.tsx` (+ filtro cliente dropdown, fix ricerca)
  - `src/components/atomic-crm/dashboard/dashboardModel.ts` (alert urgency, projectName, notes)
  - `src/components/atomic-crm/dashboard/DashboardAlertsCard.tsx` (urgency UI, PaymentAlertRow)

- Next action: **Test visivo completo**, verifica deploy Vercel aggiornato

### Sessione 12 (2026-02-27)

- Completed:
  - **Import dati Diego Caltabiano** — Migration SQL `20260227100000_import_diego_caltabiano.sql`
    - 1 client (Diego Caltabiano, codice fiscale, P.IVA, email, telefono)
    - 9 projects (GS S1, BTF S1, SPOT S1, Borghi Marinari S2, GS regolari S2, BTF S2, montaggio bonus, HD Seagate, iPhone 14)
    - 64 services (16 GS S1 + 1 bonus + 15 BTF S1 + 6 SPOT S1 + 16 Borghi S2 + 3 GS S2 + 5 BTF S2 + 2 placeholder)
    - 7 payments (€999 + €2000 + €3113 + €2500 + €2000 + €1795.19 + €2682.35 = €15,089.54)
    - 3 expenses (HD Seagate €293, HD S2 €260, iPhone 14 -€500)
  - **Import spese km** — Migration `20260227110000_import_diego_km_expenses.sql`
    - 40 record expense tipo `spostamento_km`, uno per servizio con km > 0
    - Totale km expenses: €1,245.64
  - **Pagamento pendente + split per progetto** — Migrations:
    - `20260227120000_import_diego_pending_payment.sql` — pagamento iniziale €7,152.10
    - `20260227130000_import_diego_split_payments.sql` — split in 3 pagamenti per progetto:
      - GS S2: €989.24, Borghi Marinari: €5,201.36, BTF S2: €961.50
    - Assegnato `project_id` ai pagamenti esistenti (Foglio 1 → GS, Foglio 2 acconto → Borghi)
  - **UI: Riepilogo finanziario cliente** — `ClientFinancialSummary.tsx`
    - 4 metric cards: Compensi, Rimborso km (+spese), Pagato, Da saldare
    - Aggiunto alla scheda ClientShow
  - **UI: Riepilogo finanziario progetto** — `ProjectFinancials` in `ProjectShow.tsx`
    - 4 metriche: Servizi, Compensi, Km, Totale
  - **UI: Filtro per progetto** — Aggiunto a PaymentListFilter e ExpenseListFilter
  - **UI: Colonna Progetto** — Aggiunta a PaymentListContent
  - **FIX CRITICO: Prodotto cartesiano nella view project_financials** — Migration `20260227140000_fix_project_financials_view.sql`
    - Bug: LEFT JOIN services × payments produceva N×M righe, gonfiando tutti i totali
    - Fix: pre-aggregazione in subquery prima del JOIN
    - Compensi mostrati: €73,141 → dovrebbe essere ~€20,942
  - **Verifica totali** — Python script verifica al centesimo:
    - Foglio 1: €12,407.19 ✅
    - Foglio 2: €9,834.45 ✅
    - Grand Total: €22,241.64 ✅
    - Pagamenti: €15,089.54 ✅
    - Da saldare: €7,152.10 ✅
  - **Tutte le 5 migration pushate al DB remoto** ✅
  - Typecheck: 0 errori, Build: OK

- Decisions:
  - Migration idempotente con `ON CONFLICT DO NOTHING` su settings e client
  - Km rate €0.19 applicato ai totali foglio (colonna km_amount in DB)
  - HD Seagate con markup 25% (€234 → €293 per il cliente)
  - iPhone 14 come spesa negativa (-€500) perché è un credito/detrazione
  - Montaggio bonus come progetto separato (servizio singolo a €249)
  - 2 servizi BTF S2 come placeholder (data 2025-06-01 e 2025-07-01, importi zero)
  - Spese km create come record `spostamento_km` nella tabella expenses (1 per servizio con km > 0)
  - Pagamento pendente diviso proporzionalmente per progetto (GS 13.8%, Borghi 72.7%, BTF 13.4%)
  - View fix con subquery pre-aggregation per evitare Cartesian product

- Migrations created:
  - `supabase/migrations/20260227100000_import_diego_caltabiano.sql`
  - `supabase/migrations/20260227110000_import_diego_km_expenses.sql`
  - `supabase/migrations/20260227120000_import_diego_pending_payment.sql`
  - `supabase/migrations/20260227130000_import_diego_split_payments.sql`
  - `supabase/migrations/20260227140000_fix_project_financials_view.sql`

- Files created:
  - `src/components/atomic-crm/clients/ClientFinancialSummary.tsx`

- Files modified:
  - `src/components/atomic-crm/clients/ClientShow.tsx` (+ ClientFinancialSummary)
  - `src/components/atomic-crm/projects/ProjectShow.tsx` (+ ProjectFinancials section)
  - `src/components/atomic-crm/payments/PaymentListFilter.tsx` (+ filtro progetto)
  - `src/components/atomic-crm/payments/PaymentListContent.tsx` (+ colonna Progetto)
  - `src/components/atomic-crm/expenses/ExpenseListFilter.tsx` (+ filtro progetto)

- Continued (same session):
  - **Fix invoice_ref mancanti** — Migration `20260227190000_fix_missing_invoice_refs.sql`
    - 2 pagamenti (€989.24 e €5,201.36 del 10/11/2025) senza invoice_ref → assegnato FPR 6/25
    - Query remota via REST API con service_role key (bypassa RLS)
  - **Fix payment_type acconto → saldo** — Migration `20260227210000_fix_payment_types.sql`
    - €3,113 (03/03/2025) FPR 1/25: era "acconto", è "saldo" (completa la fattura)
    - €2,682.35 (14/10/2025) FPR 4/25: era "acconto", è "saldo" (unico pagamento)
    - Verifica sistematica: lette 5 fatture PDF, confrontati importi e date
  - **Servizi BTF non fatturati** — Migration `20260227200000_complete_btf_cantina_tre_santi.sql`
    - 18/09 (vendemmia) e 21/10 (puntata finale) a Cantina Tre Santi con fee=0
    - Confronto date fatture: nessuna fattura copre quelle date → lavoro non fatturato
    - Completati con tariffe standard BTF: shooting=187, editing=125, km=120
  - **Spese e pagamento BTF mancanti** — Migration `20260227220000_btf_extra_expenses_and_payment.sql`
    - 2 expense spostamento_km (120km × €0.19 ciascuno)
    - 1 payment in_attesa €669.60 (saldo per 2 puntate BTF non fatturate)
  - **Verifica km rate da file originale** — Letto file Numbers con numbers_parser
    - Confermato €0.19/km su tutti i servizi (nessuna eccezione)
  - **Google Calendar MCP** — Configurato server MCP per Google Calendar
    - OAuth credentials Google Cloud salvate in ~/.config/google-calendar-mcp/
    - Server aggiunto con `claude mcp add` (pacchetto @cocal/google-calendar-mcp)
  - **Tutte le 4 migration pushate al DB remoto** ✅

- Decisions (continued):
  - Verifica finanziaria via fatture PDF (date + importi), non solo file originale Numbers
  - Servizi completati ma non fatturati: creare anche expense km e payment in_attesa
  - payment_type "saldo" quando il pagamento completa la fattura (anche se c'è un acconto precedente)
  - €0.19/km confermato come rate uniforme da file originale

- Migrations created (continued):
  - `supabase/migrations/20260227190000_fix_missing_invoice_refs.sql`
  - `supabase/migrations/20260227200000_complete_btf_cantina_tre_santi.sql`
  - `supabase/migrations/20260227210000_fix_payment_types.sql`
  - `supabase/migrations/20260227220000_btf_extra_expenses_and_payment.sql`

- Next action: **Test visivo completo**, deploy Vercel, verifica date BTF su Google Calendar

### Sessione 11 (2026-02-26)

- Completed:
  - **Pulizia moduli Atomic CRM** — 4 fasi completate (A→D)
    - **Fase A**: Migration DB `20260226200000_client_tasks_notes_tags.sql`
      - Tabella `client_tasks` (UUID PK, FK opzionale a clients ON DELETE SET NULL)
      - Tabella `client_notes` (UUID PK, FK obbligatoria a clients ON DELETE CASCADE)
      - Colonna `tags BIGINT[]` aggiunta a clients
      - RLS + policy su tutte le nuove tabelle
      - Pushata al DB remoto con successo
    - **Fase B**: Adattamento Tasks, Notes, Tags per clients
      - Tasks adattati: `contact_id` → `client_id`, resource `tasks` → `client_tasks`
      - 10 file nel modulo tasks/ riscritti (Task, AddTask, TaskFormContent, TaskCreateSheet, TaskEdit, TaskEditSheet, TasksIterator, TasksListFilter, TasksListEmpty)
      - Notes clienti: ClientNoteItem.tsx + ClientNotesSection.tsx (inline create/list)
      - Tags clienti: ClientTagsList.tsx + ClientTagsListEdit.tsx (in tags/)
      - ClientShow aggiornato con sezioni Tags, Note, Promemoria
      - ClientTasksSection.tsx per promemoria nella scheda cliente
      - TasksList.tsx (pagina lista desktop per tab Promemoria)
    - **Fase C**: Rimozione moduli morti
      - 5 directory eliminate: companies/ (14), contacts/ (24), deals/ (16), activity/ (9), notes/ (14)
      - Sales UI rimossa (SalesList, SalesCreate, SalesEdit, SalesInputs), tenuto SaleName + headless
      - Import module eliminato (ImportPage, useImportFromJson — era per contacts/companies)
      - Commons puliti: activity.ts, getCompanyAvatar, getContactAvatar, mergeContacts eliminati
      - FakeRest generators eliminati: companies, contacts, contactNotes, deals, dealNotes, tasks
      - supabase/dataProvider.ts: rimosso view routing companies/contacts, unarchiveDeal, getActivityLog, mergeContacts, callbacks morti
      - fakerest/dataProvider.ts: rimosso tutti callbacks companies/contacts/deals/tasks
      - SettingsPage: rimosso sezioni "Aziende" e "Trattative"
      - Header: rimosso ImportFromJsonMenuItem e UsersMenu, aggiunto tab "Promemoria"
      - MobileNavigation: rimosso contacts/companies/deals, CreateButton crea solo Promemoria
      - ConfigurationContext: rimosso companySectors, dealCategories, dealStages, dealPipelineStatuses
      - types.ts: rimosso Company, Contact, Deal, DealNote, ContactNote (old), Task (old), Activity, ContactGender
      - consts.ts: rimosso costanti activity log vecchie
      - App.tsx: aggiornato commento JSDoc
      - ContactOption.tsx eliminato, SettingsPage.test.ts (deals) eliminato
    - **Fase D**: Verifica completa
      - Typecheck: 0 errori ✅
      - Build: OK (4.35s) ✅
      - Test: 42/42 passati ✅
      - Lint: 0 nuovi errori ✅

- Decisions:
  - client_tasks.client_id è opzionale (ON DELETE SET NULL) — promemoria possono essere generici
  - client_notes.client_id è obbligatorio (ON DELETE CASCADE) — note sempre legate a un cliente
  - Tags usano BIGINT[] sulla tabella clients (match con tags.id BIGINT)
  - Import module rimosso interamente (era per formato Atomic CRM, non compatibile)
  - Sales mantenuto headless (tabella + trigger) per futuro multi-utente
  - Pagina /settings semplificata: solo Marchio, Note, Attività

- Migration created:
  - `supabase/migrations/20260226200000_client_tasks_notes_tags.sql`

- Files created (Fase B):
  - `src/components/atomic-crm/clients/ClientNoteItem.tsx`
  - `src/components/atomic-crm/clients/ClientNotesSection.tsx`
  - `src/components/atomic-crm/clients/ClientTasksSection.tsx`
  - `src/components/atomic-crm/tags/ClientTagsList.tsx`
  - `src/components/atomic-crm/tags/ClientTagsListEdit.tsx`
  - `src/components/atomic-crm/tasks/TasksList.tsx`

- Files heavily modified:
  - `src/components/atomic-crm/tasks/` (10 file — contact → client)
  - `src/components/atomic-crm/clients/ClientShow.tsx` (tags + notes + tasks)
  - `src/components/atomic-crm/root/CRM.tsx` (risorse pulite)
  - `src/components/atomic-crm/providers/supabase/dataProvider.ts` (cleanup)
  - `src/components/atomic-crm/providers/fakerest/dataProvider.ts` (cleanup)
  - `src/components/atomic-crm/settings/SettingsPage.tsx` (sezioni ridotte)
  - `src/components/atomic-crm/layout/Header.tsx` (+Promemoria, -Import, -Utenti)
  - `src/components/atomic-crm/layout/MobileNavigation.tsx` (cleanup)
  - `src/components/atomic-crm/root/ConfigurationContext.tsx` (interface ridotta)
  - `src/components/atomic-crm/root/defaultConfiguration.ts` (defaults ridotti)
  - `src/components/atomic-crm/types.ts` (+ClientTask, +ClientNote, -Company, -Contact, -Deal, ecc.)
  - `src/components/atomic-crm/consts.ts` (costanti ridotte)

- Next action: **Import dati reali Diego Caltabiano** (da docs/data-import-analysis.md)

### Sessione 10 (precedente)

- Dashboard finanziaria con Recharts (4 KPI, 2 grafici, pipeline, alert)
- Mobile dashboard KPI-only
- Fix build production (useWatch import)
- Typecheck 0, build OK

### Sessione 9 (precedente)

- Modulo Preventivi (Quotes) — Kanban 10 stati, drag-and-drop, 13 file

### Sessione 7

- DB migration Fase 2, 5 moduli CRUD, 60/60 test

## Previous Sessions

- 2026-02-26 (sessione 10): Dashboard finanziaria Recharts
- 2026-02-26 (sessione 9): Modulo Preventivi Kanban
- 2026-02-26 (sessione 8): Solo documentazione
- 2026-02-26 (sessione 7): 5 moduli CRUD + migration
- 2026-02-25 (sessione 6): Design completo Fase 2
- 2026-02-25 (sessione 5): Deploy Vercel, Edge Functions, CORS
- 2026-02-25 (sessione 4): Audit, fix signup, keep-alive
- 2026-02-25 (sessione 3): Fix stringhe inglesi
- 2026-02-25 (sessione 2): i18n Provider, ~200+ stringhe
- 2026-02-25 (sessione 1): Fork, Supabase remoto, migration, RLS

## Next Steps

1. [x] DB migration (discount + tariffe + views)
2. [x] Modulo Clienti
3. [x] Modulo Progetti
4. [x] Modulo Registro Lavori (Services)
5. [x] Modulo Preventivi (Quotes)
6. [x] Modulo Pagamenti
7. [x] Modulo Spese
8. [x] Dashboard Recharts
9. [x] Pulizia moduli Atomic CRM + adattamento Tasks/Notes/Tags
10. [x] Import dati reali Diego Caltabiano (84 record + 40 km expenses + 3 split payments)
11. [x] Fix prodotto cartesiano view project_financials + UI finanziari (ClientShow, ProjectShow)
12. [ ] Test visivo completo di ogni modulo (in corso)
13. [ ] Deploy su Vercel e test in produzione

## Remaining Low-Priority Items

- FakeRest data generators usano `faker/locale/en_US` (solo demo mode, non produzione)
- 4 vulnerabilità npm (1 moderate, 3 high) — da valutare con `npm audit`
- Warnings Vitest su promise non awaited in supabaseAdapter.spec.ts (codice upstream)
- Verificare che signup sia disabilitato anche nel **Supabase Dashboard remoto**
- 3 errori lint pre-esistenti (useGetOne condizionale in ExpenseShow/PaymentShow, mergeTranslations inutilizzato in i18nProvider)

## Certezze (sessione 12)

- [x] Import Diego Caltabiano: 84 record + 40 km expenses + 3 split payments = 127 record totali
- [x] Totali verificati al centesimo: €22,241.64 totale, €15,089.54 pagato, €7,152.10 da saldare
- [x] 5 migration pushate al DB remoto con successo
- [x] Fix prodotto cartesiano view project_financials (subquery pre-aggregation)
- [x] Filtri per progetto aggiunti a Pagamenti e Spese
- [x] Colonna Progetto aggiunta alla lista Pagamenti
- [x] Riepilogo finanziario su ClientShow e ProjectShow
- [x] Typecheck 0 errori, build OK

## Certezze (sessione 11)

- [x] Pulizia completata: 0 moduli Atomic CRM residui (companies, contacts, deals eliminati)
- [x] Tasks adattati come "Promemoria" (client_tasks), Notes come "Note clienti" (client_notes), Tags su clients
- [x] Navigazione aggiornata con 8 tab (+ Promemoria)
- [x] Typecheck 0 errori, build OK, 42/42 test, lint 0 nuovi errori
- [x] Migration client_tasks + client_notes + tags applicata al DB remoto

## Architectural Decisions Log

| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-02-25 | Fork Atomic CRM come base | Stack compatibile, CRM modulare, MIT license |
| 2026-02-25 | Preservare .claude/skills/ e AGENTS.md | Guide preziose per sviluppo |
| 2026-02-25 | Nuova migration SQL anziché modificare le esistenti | Schema completamente diverso |
| 2026-02-25 | Recharts per grafici dashboard | Specifica lo richiede, gratuito |
| 2026-02-25 | RLS policy semplice auth.uid() IS NOT NULL | Single user |
| 2026-02-25 | Traduzioni inline nei componenti | Atomic CRM non usa useTranslate() |
| 2026-02-25 | Alias Vite per react-router | Compatibilità v6/v7 |
| 2026-02-25 | Audit obbligatorio a fine fase | Trovati problemi critici in fase "completata" |
| 2026-02-26 | Moduli custom in directory separate | Non modificare i moduli originali, più pulito |
| 2026-02-26 | Navigazione progressiva | Aggiungere tab man mano che i moduli vengono creati |
| 2026-02-26 | Table component per le liste | Più appropriato di CardList per dati tabulari |
| 2026-02-26 | Quotes usa Dialog modali come Deals | Pattern Kanban richiede overlay, non pagine dedicate |
| 2026-02-26 | Quote statuses come costanti locali | Fissi nel DB CHECK, non serve ConfigurationContext |
| 2026-02-26 | Niente archived_at per quotes | Status finali (saldato/rifiutato/perso) coprono il caso |
| 2026-02-26 | Dashboard aggregata | Componenti UI piccoli, dati/trasformazioni centralizzati |
| 2026-02-26 | Primary key esplicite per views | monthly_revenue e project_financials non hanno id |
| 2026-02-26 | client_tasks con FK opzionale | Promemoria possono essere generici o legati a un cliente |
| 2026-02-26 | Import module rimosso | Era per formato Atomic CRM (contacts/companies), non compatibile |
| 2026-02-26 | Sales headless (senza UI) | Tabella+trigger mantenuti per futuro multi-utente |

## Sessione 79 (2026-03-01, edge function env hygiene)

- [x] `supabase/functions/.env` rimosso dal perimetro versionato del repo
- [x] Creato `supabase/functions/.env.example` con placeholder per tutte le
  variabili Edge Functions attuali
- [x] Eliminati i residui `POSTMARK_*` dal template committato, coerentemente con
  la decisione di prodotto di non reintrodurre Postmark
- [x] Regola di continuità documentata: secret reali solo in env locali / secret
  remoti, mai in git

## Sessione 80 (2026-03-01, remote ORS runtime verification)

- [x] `OPENROUTESERVICE_API_KEY` impostata sul progetto remoto
  `qvdmzhyzpyaveniirsmo`
- [x] `OPENROUTESERVICE_BASE_URL` impostata sul runtime remoto Edge Functions
- [x] `unified_crm_answer` redeployata sul progetto remoto
- [x] Smoke autenticato remoto chiuso sul flow km con domanda reale:
  `Valguarnera Caropepe - Catania` A/R
- [x] Risposta remota verificata:
  - HTTP `200`
  - model `openrouteservice`
  - first action `expense_create_km`
  - handoff `/#/expenses/create` con `km_distance=160.98` e `km_rate=0.19`
- [x] Utente smoke remoto ripulito dopo la verifica

## Sessione 81 (2026-03-01, launcher expense routing + chat continuity)

- [x] Corretto il parser `spostamento_km` per frasi naturali come
  `da ... fino al ...`, date italiane esplicite e formule tipo
  `sia l'andata che il ritorno`
- [x] Bloccato il fallback errato a `payments` quando l'intento reale e'
  creare una `spesa` / rimborso km
- [x] Aggiunto reset esplicito `Nuova` nella chat del launcher
- [x] Aggiunta history recente dei turni passata alla Edge Function del launcher
- [x] UI mantenuta pulita: una sola answer card visibile, non un log lungo
- [x] Test verdi:
  - `npm run typecheck`
  - `vitest --run supabase/functions/_shared/unifiedCrmAnswer.test.ts src/components/atomic-crm/ai/UnifiedAiLauncher.test.tsx`
- [x] Guardrail documentato:
  - il launcher puo' ancorarsi al progetto trovato in snapshot
  - ma non deve inventare l'esistenza del servizio/lavoro specifico se quel
    livello non e' realmente nel contesto read-only

## Sessione 82 (2026-03-01, manual km calculator across UI)

- [x] Aggiunto calcolatore tratta km riusabile nelle UI operative che
  manipolano davvero `km_distance` / `km_rate`:
  - `ExpenseInputs`
  - `ServiceInputs`
  - `QuickEpisodeForm`
- [x] Nuova Edge Function `travel_route_estimate` con provider entry point
  dedicato per stimare la tratta lato server tramite openrouteservice
- [x] Dialog condiviso con:
  - partenza
  - arrivo
  - andata / andata e ritorno
  - tariffa `EUR/km` precompilata dal default condiviso ma modificabile
- [x] `QuickEpisodeForm` ora mostra anche `km_rate` esplicitamente, non solo i km
- [x] Applicazione stima:
  - aggiorna km e tariffa nel form ospite
  - puo' precompilare descrizione spesa o localita' se ancora vuote
- [x] Test verdi:
  - `npm run typecheck`
  - `vitest --run src/components/atomic-crm/travel/TravelRouteCalculatorDialog.test.tsx supabase/functions/_shared/travelRouteEstimate.test.ts src/lib/semantics/crmCapabilityRegistry.test.ts src/lib/semantics/crmSemanticRegistry.test.ts`

## Sessione 83 (2026-03-01, launcher km route-only intent fix)

- [x] Allargato il parser deterministico `spostamento_km` anche alle richieste
  di sola stima tratta, senza obbligare la parola `spesa`
  - esempio chiuso: `Calcola i km andata e ritorno per la tratta Valguarnera Caropepe (EN) - Catania`
- [x] Copy della risposta km riallineato
  - non assume piu' che l'utente voglia necessariamente salvare la spesa
  - ma offre comunque il passaggio approvato verso `/#/expenses/create`
- [x] Copertura test estesa
  - helper backend `parseUnifiedCrmTravelExpenseQuestion`
  - launcher UI sul handoff `expense_create_km`
- [x] Continuita' aggiornata in `handoff`, `backlog`, `progress`, `learnings`
- [x] Runtime remoto riallineato
  - redeploy di `unified_crm_answer` sul progetto Supabase linkato

- [x] Validation:
  - `pnpm typecheck`
  - `pnpm vitest run supabase/functions/_shared/unifiedCrmAnswer.test.ts src/components/atomic-crm/expenses/expenseLinking.test.ts src/components/atomic-crm/ai/UnifiedAiLauncher.test.tsx`
  - `npx supabase functions deploy unified_crm_answer`

## Sessione 84 (2026-03-01, launcher longer chat questions)

- [x] Esteso il limite domanda della chat IA unificata da `300` a `1200`
  caratteri
  - composer compatto
  - editor esteso full-screen
  - validazione `unified_crm_answer`
- [x] Evitato il mismatch UX/backend
  - il launcher non lascia piu' credere di accettare testo piu' lungo di quanto
    la Edge Function possa davvero processare
- [x] Copertura test aggiunta
  - validazione backend sul boundary `1200` / `1201`
  - launcher UI sul nuovo `maxLength`
- [x] Runtime remoto riallineato
  - redeploy di `unified_crm_answer`

- [x] Validation:
  - `pnpm typecheck`
  - `pnpm vitest run supabase/functions/_shared/unifiedCrmAnswer.test.ts src/components/atomic-crm/expenses/expenseLinking.test.ts src/components/atomic-crm/ai/UnifiedAiLauncher.test.tsx`

## Sessione 85 (2026-03-01, travel-route invalid JWT stabilization)

- [x] Corretto il corridoio auth del dialog `Calcola tratta` dopo il primo
  smoke reale su mobile/Vercel con toast `Invalid JWT`
- [x] Riallineato `supabase/config.toml`
  - aggiunta entry `[functions.travel_route_estimate]`
  - `verify_jwt = false` coerente col modello già usato dalle altre function UI
- [x] Rafforzato il provider Supabase
  - le invoke delle Edge Function risolvono ora un access token utente fresco
  - l'header `Authorization` viene passato esplicitamente, senza affidarsi al
    fallback implicito dell'SDK
- [x] Aggiunta copertura test sul nuovo helper auth
- [x] Validation:
  - `npm run typecheck`
  - `npx vitest --run src/components/atomic-crm/providers/supabase/edgeFunctions.test.ts src/components/atomic-crm/travel/TravelRouteCalculatorDialog.test.tsx`

## Sessione 86 (2026-03-01, travel-route mobile scroll + autocomplete hardening)

- [x] Chiuso il blocco di scroll reale nel modale `Calcola tratta km` su
  iPhone/mobile
  - `DialogContent` del calcolatore non resta piu' centrato con altezza
    implicita oltre viewport
  - layout ristrutturato con header/footer fissi e body interno scrollabile
  - aggiunto padding safe-area bottom per non schiacciare le CTA contro la
    toolbar mobile
- [x] Rafforzato il corridoio autocomplete luoghi
  - il suggeritore usa il ramo `geocode/autocomplete` del geocoder ORS, coerente
    con la documentazione ufficiale
  - assenza risultati non viene piu' trattata come errore bloccante ma come
    lista vuota gestibile dalla UI
  - aggiunta entry `[functions.travel_location_suggest]` in
    `supabase/config.toml` per tenere coerente il runtime edge
- [x] Continuita' aggiornata
  - `progress.md`
  - `learnings.md`
- [x] Runtime remoto riallineato
  - deploy di `travel_location_suggest` sul progetto Supabase linkato

## Sessione 87 (2026-03-01, launcher project write handoff for TV work items)

- [x] Esteso il launcher CRM read-only con un nuovo handoff approvato verso il
  workflow reale `project quick episode` per richieste come:
  - `nuovo lavoro`
  - `nuovo servizio`
  - `registra puntata`
  - richieste TV con `intervista ...` e spesa viaggio collegata
- [x] Nuovo branch deterministico in `unified_crm_answer`
  - aggancia il progetto attivo piu' coerente dallo snapshot
  - estrae data italiana esplicita
  - estrae nota operativa tipo `Intervista a Roberto Lipari`
  - riconosce anche wording round-trip tipo `andate e ritorno`
  - prova a risolvere tratte scritte senza delimitatore esplicito, ad esempio
    `Valguarnera Caropepe Acireale`
- [x] Nuovo handoff `project_quick_episode`
  - apre `/#/projects/:id/show`
  - auto-apre il dialog `Puntata`
  - porta prefills per `service_date`, `service_type`, `km_distance`,
    `km_rate`, `location`, `notes`
- [x] UI progetto riallineata
  - banner esplicito in `ProjectShow`
  - `QuickEpisodeDialog` auto-open da search params launcher
  - `QuickEpisodeForm` ora accetta default completi e non solo fee defaults
  - parser dedicato `projectQuickEpisodeLinking`
- [x] Copy launcher meno rigido
  - se l'utente chiede `servizio`, l'azione e la risposta parlano di
    `servizio`, non forzano sempre `puntata`
- [x] Continuita' aggiornata
  - `progress.md`
  - `docs/historical-analytics-handoff.md`
  - `docs/historical-analytics-backlog.md`
- [x] Validation:
  - `npm run typecheck`
  - `npx vitest --run supabase/functions/_shared/unifiedCrmAnswer.test.ts src/components/atomic-crm/payments/paymentLinking.test.ts src/components/atomic-crm/projects/projectQuickEpisodeLinking.test.ts`

Rischio esplicito lasciato aperto:

- il caso generico `nuovo servizio` per progetti non TV non passa ancora da
  `services/create`; questa estensione va trattata come slice successiva,
  separata dal handoff TV gia chiuso.

## Sessione 88 (2026-03-01, launcher Pareto per servizi/spese fuori dal TV)

- [x] Chiuso il rischio lasciato aperto nella sessione 87
  - il caso generico `nuovo servizio` su progetto non TV ora atterra su
    `services/create`
  - il launcher non forza piu' il dialog TV quando il progetto attivo e'
    `wedding`, `spot`, `sviluppo_web` o comunque non TV
- [x] Handoff generico `service_create`
  - `unified_crm_answer` distingue ora i progetti TV dai non TV usando anche
    `projectCategory` e `projectTvShow` nello snapshot read-only
  - il form `ServiceCreate` legge prefills/search params launcher e mostra un
    banner contestuale
  - l'handoff puo' portare `project_id`, `service_date`, `service_type`,
    `km_distance`, `km_rate`, `location`, `notes`
- [x] Handoff generico `expense_create`
  - la chat puo' ora aprire `expenses/create` anche per spese non km
  - l'associazione segue la regola Pareto richiesta:
    - se trova un progetto, porta `cliente + progetto`
    - altrimenti, se trova solo il cliente, porta almeno `cliente`
  - parsing minimo coperto per casi come:
    - `casello autostradale`
    - `pranzo`
    - `noleggio`
    - `acquisto materiale`
    - importi tipo `12,50 euro`
- [x] TV quick-episode riallineato al nuovo requisito spese
  - `QuickEpisodeForm` espone ora anche spese extra non km nello stesso
    salvataggio
  - `QuickEpisodeDialog` salva davvero:
    - servizio
    - spesa km se presente
    - spese extra aggiunte nel dialog
  - tutte le spese create dal quick-episode restano collegate a
    `client_id + project_id`
- [x] Capability/docs/test riallineati
  - aggiornati registry capability e tipi AI condivisi
  - aggiornati `progress.md`, `docs/historical-analytics-handoff.md`,
    `docs/historical-analytics-backlog.md`, `learnings.md`
- [x] Validation:
  - `npm run typecheck`
  - `npx vitest --run supabase/functions/_shared/unifiedCrmAnswer.test.ts src/components/atomic-crm/expenses/expenseLinking.test.ts src/components/atomic-crm/projects/projectQuickEpisodeLinking.test.ts src/components/atomic-crm/projects/quickEpisodePersistence.test.ts src/components/atomic-crm/services/serviceLinking.test.ts src/lib/semantics/crmCapabilityRegistry.test.ts src/lib/ai/unifiedCrmReadContext.test.ts`

Rischio residuo esplicito:

- fuori dal TV non esiste ancora una superficie unica che salvi servizio e
  spese insieme; per scelta Pareto restano due handoff approvati separati:
  `services/create` e `expenses/create`
