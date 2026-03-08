/**
 * Visual-mode instructions appended to the AI prompt when the user
 * toggles "Vista smart". The AI responds with a JSON array of typed
 * blocks instead of markdown, and the frontend renders each block
 * with dedicated UI components.
 */
export const visualModeInstructions = `

═══ FORMATO DI OUTPUT ═══

Rispondi SOLO con un array JSON di blocchi visuali.
Il frontend li renderizza come componenti grafici nel design system dell'app.
NON scrivere markdown, NON avvolgere in \`\`\`json\`\`\`, NON aggiungere testo fuori dall'array.
Produci l'output finale solo dopo aver verificato lo schema.
L'output finale deve essere esclusivamente l'array JSON.

Hai a disposizione una tavolozza di blocchi. Scegli quelli giusti per
comunicare nel modo piu chiaro, come un grafico che sceglie la
visualizzazione migliore per ogni dato.

═══ SCHEMA BLOCCHI ═══

Ogni elemento dell'array deve essere un oggetto con il campo "type" obbligatorio.
Il campo "type" determina quali altri campi sono ammessi.
Non aggiungere campi non previsti dallo schema.
Non inventare proprieta nuove.
Non generare blocchi con array vuoti (es. "items": []).
Se non hai dati sufficienti per un blocco, non usare quel blocco.

Tipi disponibili e campi ammessi:

"text"
{ "type": "text", "content": string }

"callout"
{ "type": "callout", "tone": "info"|"warning"|"success", "content": string }
Box evidenziato. Usalo con parsimonia — se tutto e evidenziato, niente lo e.

"action"
{ "type": "action", "content": string }
Azione concreta. Solo per cose che l'utente puo realmente fare.
Se non ci sono azioni utili, non inserire blocchi action.

"metrics"
{ "type": "metrics", "items": [{ "label": string, "value": string, "color"?: palette-color }] }
Riga di numeri grandi. Da 1 a 4 items per riga.
Usalo quando un numero deve VEDERSI, non leggersi nel testo.

"list"
{ "type": "list", "title"?: string, "items": [string] }
Lista puntata. Ogni item breve — una riga, non un paragrafo.

"bar-chart"
{ "type": "bar-chart", "title"?: string, "items": [{ "label": string, "value": number, "color"?: palette-color }] }
Barre orizzontali proporzionali. Per confrontare grandezze dello stesso tipo.
Esempio: ricavi per cliente, spese per categoria, lavoro per tipo.

"progress"
{ "type": "progress", "label": string, "current": number, "total": number, "color"?: palette-color }
Barra di progresso. Per rapporti parte/tutto.
Esempio: incassato vs totale, budget usato.

"trend"
{ "type": "trend", "label"?: string, "points": [{ "label": string, "value": number }], "unit"?: string }
Grafico a linea. Per sequenze temporali.
Esempio: ricavi mensili, andamento trimestrale.

"comparison"
{ "type": "comparison", "left": { "label": string, "value": string }, "right": { "label": string, "value": string }, "delta"?: string, "deltaDirection"?: "up"|"down"|"flat" }
Due valori affiancati con delta. Per confronti diretti.
Esempio: 2025 vs 2026, entrate vs uscite.

"breakdown"
{ "type": "breakdown", "title"?: string, "items": [{ "label": string, "value": number, "color"?: palette-color }] }
Composizione di un totale con percentuali.
Usalo SOLO con 2-5 voci. Con 1 voce e inutile, con piu di 5 usa "bar-chart".

═══ COLORI (palette-color) ═══

Il campo "color" puo essere SOLO uno tra questi valori:
emerald, red, amber, sky, blue, violet, rose, gray

Non usare altri nomi (es. "green", "yellow", "orange" non esistono).

Significato:
- "emerald" = positivo, soldi che hai, crescita
- "red" = negativo, costi, calo
- "amber" = attesa, attenzione, da verificare
- "sky" = neutro, informativo
- "blue" = confronto, riferimento
- "violet" = evidenza, punto focale
- "rose" = critico ma non grave
- "gray" = secondario, contesto

═══ COMPOSIZIONE ═══

- Inizia normalmente con un blocco "text" che riassume la situazione,
  a meno che la domanda sia puramente numerica.
- Usa i grafici quando i dati li giustificano — non forzare un grafico
  dove basta un numero o una frase.
- Se non ci sono dati numerici nel contesto per la domanda, NON usare
  grafici. Usa solo blocchi text, list o action.
- Se un numero e in un "metrics", non ripeterlo nel "text".
- L'ordine dei blocchi e libero: metti prima cio che conta di piu.
- Preferisci poche visualizzazioni chiare piuttosto che molte
  visualizzazioni ridondanti. Normalmente usa tra 2 e 6 blocchi.
- Un "bar-chart" con 1 sola barra non ha senso. Un "trend" con 2 punti
  e debole. Un "breakdown" con 1 voce e inutile. Scegli il blocco
  giusto per la quantita di dati che hai.
- Preferisci mostrare a spiegare: se puoi comunicare un concetto con un
  grafico invece che con una frase, usa il grafico.
- Le label devono essere brevi (1-4 parole). Evita frasi lunghe nelle
  etichette dei grafici e delle metriche.
- I valori nei blocchi "metrics" sono stringhe formattate (es. "4.972 €").
- I valori nei blocchi grafici (bar-chart, progress, trend, breakdown)
  sono numeri puri senza simbolo (es. 4972).
- Se non sei sicuro della struttura dei dati, usa solo blocchi "text".

═══ VALIDAZIONE ═══

Prima di rispondere verifica:
- L'output e un array JSON valido (inizia con [ e finisce con ])
- Tutti i blocchi hanno il campo "type"
- Ogni blocco usa solo i campi definiti nel suo schema
- I grafici hanno numeri (non stringhe) nei campi value/current/total
- I colori sono solo quelli della palette
- Nessun blocco ha array vuoti
- Non esiste testo fuori dall'array
- Non ci sono trailing commas (virgole dopo l'ultimo elemento)
Se l'output non rispetta le regole, rigenera la risposta.

═══ ESEMPIO 1 — con dati numerici ═══

[
  { "type": "text", "content": "Nel 2026 finora il lavoro svolto vale 4.972 euro. Anno non chiuso, dati provvisori." },
  { "type": "metrics", "items": [
    { "label": "Lavoro", "value": "4.972 €", "color": "sky" },
    { "label": "Incassato", "value": "1.746 €", "color": "emerald" },
    { "label": "Spese", "value": "373 €", "color": "red" }
  ]},
  { "type": "breakdown", "title": "Composizione lavoro", "items": [
    { "label": "Spot", "value": 2544, "color": "sky" },
    { "label": "Produzione TV", "value": 2428, "color": "violet" }
  ]},
  { "type": "callout", "tone": "warning", "content": "Un solo cliente copre il 100% del lavoro registrato." },
  { "type": "action", "content": "Verificare il pagamento atteso il 16/03." }
]

═══ ESEMPIO 2 — senza dati numerici rilevanti ═══

[
  { "type": "text", "content": "Non ci sono abbastanza dati numerici nel contesto per rispondere con precisione a questa domanda." },
  { "type": "list", "title": "Possibili verifiche", "items": [
    "Controllare se ci sono servizi non ancora registrati",
    "Verificare lo stato dei preventivi aperti"
  ]},
  { "type": "action", "content": "Registrare i servizi svolti prima di chiedere un'analisi." }
]
`.trim();
