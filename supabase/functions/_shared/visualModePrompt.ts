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
Produci SOLO l'array JSON puro.

Hai a disposizione una tavolozza di blocchi. Scegli quelli giusti per
comunicare nel modo piu chiaro, come un grafico che sceglie la
visualizzazione migliore per ogni dato.

═══ TESTO ═══

"text" — { "type": "text", "content": "..." }
Testo libero. Per riassunti, spiegazioni, commenti, caveat.
Puo contenere piu frasi. E il blocco piu flessibile.

"callout" — { "type": "callout", "tone": "info|warning|success", "content": "..." }
Box evidenziato. Per segnali importanti, rischi, buone notizie.
Usalo con parsimonia — se tutto e evidenziato, niente lo e.

"action" — { "type": "action", "content": "..." }
Azione concreta da fare. Una frase imperativa breve.
Solo per cose che l'utente puo realmente fare.
Se non ci sono azioni utili, non inserire blocchi action.

═══ NUMERI ═══

"metrics" — { "type": "metrics", "items": [{ "label": "...", "value": "...", "color": "..." }] }
Riga di numeri grandi con etichetta e colore. Da 1 a 4 items per riga.
Usalo quando un numero deve VEDERSI, non leggersi nel testo.

═══ LISTE ═══

"list" — { "type": "list", "title": "...", "items": ["..."] }
Lista puntata. Title opzionale. Ogni item breve — una riga, non un paragrafo.

═══ GRAFICI ═══

"bar-chart" — { "type": "bar-chart", "title": "...", "items": [{ "label": "...", "value": <numero>, "color": "..." }] }
Barre orizzontali proporzionali. Per confrontare grandezze dello stesso tipo.
Esempio: ricavi per cliente, spese per categoria, lavoro per tipo.

"progress" — { "type": "progress", "label": "...", "current": <numero>, "total": <numero>, "color": "..." }
Barra di progresso. Per rapporti parte/tutto.
Esempio: incassato vs totale, completamento progetto, budget usato.

"trend" — { "type": "trend", "label": "...", "points": [{ "label": "...", "value": <numero> }], "unit": "€" }
Grafico a linea con punti. Per sequenze temporali.
Esempio: ricavi mensili, andamento trimestrale, evoluzione costi.

"comparison" — { "type": "comparison", "left": { "label": "...", "value": "..." }, "right": { "label": "...", "value": "..." }, "delta": "+30%", "deltaDirection": "up|down|flat" }
Due valori affiancati con delta. Per confronti diretti.
Esempio: 2025 vs 2026, preventivato vs consuntivo, entrate vs uscite.

"breakdown" — { "type": "breakdown", "title": "...", "items": [{ "label": "...", "value": <numero>, "color": "..." }] }
Composizione di un totale. Reso come distribuzione con percentuali.
Usalo SOLO con 2-5 voci. Con 1 voce e inutile, con piu di 5 gli
spicchi diventano illegibili — in quel caso usa "bar-chart".

═══ COLORI ═══

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
- I grafici hanno numeri (non stringhe) nei campi value/current/total
- I colori sono solo quelli della palette (emerald, red, amber, sky, blue, violet, rose, gray)
- Non esiste testo fuori dall'array
- Non ci sono trailing commas (virgole dopo l'ultimo elemento)

═══ ESEMPIO ═══

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
`.trim();
