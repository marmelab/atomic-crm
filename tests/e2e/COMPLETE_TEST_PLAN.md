# Piano di Test Integrale - Gestionale Rosario Furnari

## Obiettivo
Testare ogni singola funzionalità dell'applicazione in modo deterministico.

## Moduli da Testare

### 1. CLIENTI (clients)
- [ ] Lista clienti con filtri
- [ ] Creazione cliente
- [ ] Modifica cliente
- [ ] Visualizzazione cliente (show)
- [ ] Profilo fiscale (billing)
- [ ] Tags cliente
- [ ] Note cliente
- [ ] Promemoria cliente
- [ ] Eliminazione cliente

### 2. REFERENTI (contacts)
- [ ] Lista referenti
- [ ] Creazione referente
- [ ] Modifica referente
- [ ] Collegamento a cliente
- [ ] Collegamento a progetto
- [ ] Referente primario cliente
- [ ] Referente primario progetto

### 3. PROGETTI (projects)
- [ ] Lista progetti con filtri
- [ ] Creazione progetto
- [ ] Modifica progetto
- [ ] Visualizzazione progetto
- [ ] Riepilogo finanziario progetto
- [ ] Quick episode (puntata TV)
- [ ] Quick payment
- [ ] Bozza fattura da progetto
- [ ] Eliminazione progetto

### 4. REGISTRO LAVORI (services)
- [ ] Lista servizi con filtri
- [ ] Creazione servizio
- [ ] Modifica servizio
- [ ] Visualizzazione servizio
- [ ] Calcolo km e rimborsi
- [ ] Tassabilità servizio
- [ ] Bozza fattura da servizio
- [ ] Duplicazione servizio
- [ ] Eliminazione servizio

### 5. PREVENTIVI (quotes)
- [ ] Pipeline Kanban
- [ ] Creazione preventivo
- [ ] Modifica preventivo
- [ ] Visualizzazione preventivo
- [ ] Cambio stato (drag & drop)
- [ ] Itemizzazione voci
- [ ] Creazione progetto da preventivo
- [ ] Creazione pagamento da preventivo
- [ ] Invio email cliente
- [ ] PDF preventivo
- [ ] Eliminazione preventivo

### 6. PAGAMENTI (payments)
- [ ] Lista pagamenti con filtri
- [ ] Creazione pagamento
- [ ] Modifica pagamento
- [ ] Visualizzazione pagamento
- [ ] Stati: ricevuto/in attesa/scaduto
- [ ] Tipi: acconto/saldo/parziale/rimborso
- [ ] Collegamento a progetto/preventivo
- [ ] Scadenzario
- [ ] Eliminazione pagamento

### 7. SPESE (expenses)
- [ ] Lista spese con filtri
- [ ] Creazione spesa
- [ ] Modifica spesa
- [ ] Visualizzazione spesa
- [ ] Tipi: km/materiale/noleggio/altro
- [ ] Calcolo markup
- [ ] Calcolo km
- [ ] Collegamento a progetto
- [ ] Eliminazione spesa

### 8. PROMEMORIA (tasks)
- [ ] Lista promemoria
- [ ] Creazione promemoria
- [ ] Modifica promemoria
- [ ] Completamento
- [ ] Filtri temporali
- [ ] Collegamento a cliente
- [ ] Eliminazione promemoria

### 9. DASHBOARD
- [ ] Vista annuale
- [ ] Vista storica
- [ ] KPI finanziari
- [ ] Grafici
- [ ] Scadenzario operativo
- [ ] AI summaries

### 10. IMPOSTAZIONI
- [ ] Marchio
- [ ] Etichette
- [ ] Tipi preventivo
- [ ] Tipi servizio
- [ ] Operatività (km rate)
- [ ] Fiscale
- [ ] AI

### 11. AI & AUTOMATION
- [ ] Chat AI unificata
- [ ] Snapshot CRM
- [ ] Import fatture
- [ ] Bozze fattura da AI

### 12. INTEGRAZIONI
- [ ] PDF bozza fattura
- [ ] PDF preventivo
- [ ] Email (Gmail)

## Statistiche
- Moduli: 12
- Funzionalità: ~80
- Test da creare: ~60
