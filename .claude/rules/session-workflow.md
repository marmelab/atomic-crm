# Session Workflow & Continuity Rules

## Source Priority

Quando i documenti entrano in conflitto, l'ordine corretto e':

1. codice reale, migration, Edge Functions
2. `docs/README.md` e documenti `canonical`
3. documenti `working`
4. `progress.md` e `learnings.md` come archivio storico

## SESSION START

Leggere sempre in questo ordine minimo:

1. `docs/README.md`
2. `docs/development-continuity-map.md`
3. `docs/historical-analytics-handoff.md`
4. `docs/architecture.md`

Leggere anche i documenti di dominio se pertinenti:

- `docs/contacts-client-project-architecture.md`
- `docs/data-import-analysis.md`
- `Gestionale_Rosario_Furnari_Specifica.md`

Leggere `progress.md` e `learnings.md` solo se serve:

- ricostruire la sequenza cronologica di una decisione
- recuperare un pattern storico specifico
- capire perche' una regola e' nata

Comunicazione iniziale:

- riassumere fase corrente, slice aperta e assunzioni operative
- non chiedere conferma preventiva se la richiesta e' chiara e il lavoro e'
  sicuro/reversibile
- chiedere invece solo quando c'e' ambiguita' rischiosa, impatto distruttivo o
  tradeoff architetturale non deducibile dal repo

## COMMIT GATE — OBBLIGATORIO, NON NEGOZIABILE

PRIMA di eseguire `git commit` su codice prodotto, verificare SEMPRE:

1. `docs/` — il pre-commit hook lo blocca se mancano, ma includerli nello
   STESSO commit, non in un commit separato dopo
2. `memory/*.md` — aggiornare se il cambiamento tocca architettura, moduli,
   pattern o convenzioni. Includerli nello STESSO commit
3. `.claude/learning.md` — aggiornare se e' emerso un pattern nuovo o un
   errore significativo. Includerli nello STESSO commit

Se il commit contiene codice prodotto e i docs/memoria vanno aggiornati,
devono essere TUTTI nello stesso `git add` + `git commit`. MAI fare prima il
commit di codice e poi un commit separato "docs: align...". Questo e' il
pattern sbagliato che causa disallineamenti.

Sequenza corretta:
```
codice → test → docs + memoria → git add TUTTO → git commit UNICO
```

Sequenza VIETATA:
```
codice → git add codice → git commit → "ah si, i docs" → git commit docs
```

## POST-PUSH CI CHECK — OBBLIGATORIO

Dopo OGNI `git push`, controllare AUTONOMAMENTE il CI:

```
git push
↓
gh run list --limit 1 --json databaseId -q '.[0].databaseId'
↓
gh run view <id> --log-failed
↓
se fallisce: fixare e re-pushare SENZA aspettare l'utente
```

NON aspettare che l'utente mandi screenshot dei fallimenti CI.
L'utente NON deve fare da intermediario tra me e GitHub Actions.

## CORE LOOP

Dopo ogni lavoro non banale:

1. `Reflect`
   - cosa e' cambiato davvero
   - quale regola o pattern e' emerso
2. `Triage`
   - applicare subito nel codice
   - promuovere a docs/rules
   - oppure lasciare come nota storica se non vale una promozione
3. `Cascade`
   - fare sweep sulle superfici collegate seguendo
     `docs/development-continuity-map.md`

## SESSION END

Aggiornare sempre, se toccati dal cambiamento reale:

1. documenti `canonical`
2. `docs/historical-analytics-handoff.md` e backlog se cambia il prossimo step
   o la stop line
3. `Settings` se la modifica e' config-driven

Aggiornare `progress.md` e `learnings.md` solo se c'e' valore storico reale:

- `progress.md`
  - milestone importante
  - verifica runtime/manuale significativa
  - decisione che serve ricostruire nel tempo
- `learnings.md`
  - pattern nuovo non banale
  - errore reale che vale la pena non ripetere

Quando li aggiorni:

- mantenere in alto un indice/uso rapido breve
- non far crescere un mega-riassunto cumulativo nello stesso blocco
- se una regola e' viva, promuoverla fuori dagli archivi
- se il rumore supera il valore, preferire una futura rotazione per periodo
  invece di continuare ad accumulare tutto nel file principale

## PROMOTION RULE

Se una regola ricorre 2+ volte, non lasciarla solo in `learnings.md`.
Promuoverla in una sola casa stabile:

- `.claude/rules/` per workflow/regole operative
- `docs/development-continuity-map.md` per sweep e integrazione
- `docs/architecture.md` per fotografia implementativa
- documento di dominio dedicato per logica business locale

## ANTI-PATTERNS

- partire da `progress.md` o `learnings.md` come fonte primaria
- duplicare la stessa regola in piu' documenti senza dichiarare una casa
  canonica
- finire una modifica senza sweep delle superfici collegate
- aggiornare `Settings` per riflesso quando la modifica non e' configurabile
- lasciare `.claude/rules/` disallineate dai documenti `canonical`
