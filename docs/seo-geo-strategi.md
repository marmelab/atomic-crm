# Hemsidestatistik, SEO & AI-synlighet — Strategidokument för Axona Digital AB

> Praktisk guide för att (a) förstå hemsidestatistiken Axonas CRM samlar in, (b) rapportera rätt siffror till kund, och (c) sälja relevanta upsells. Skriven juni 2026. Alla riktvärden är verifierade mot 2026-aktuella källor (URL:er löpande).

**Den enda meningen du behöver komma ihåg:** Sökning har flyttat från "Google visar tio länkar" till "AI svarar direkt och klickar sällar vidare". I april 2026 slutade ~68 % av alla Google-sökningar utan ett enda klick, och sidor med en AI Overview ovanför har ~83 % nollklick ([SparkToro](https://sparktoro.com/blog/in-2026-less-than-one-third-of-google-searches-still-send-a-click/), [SeoProfy](https://seoprofy.com/blog/google-ai-overviews/)). Det betyder att "synas i AI-svaret" och "ladda snabbt + konvertera de få som faktiskt klickar" är värt mer 2026 än ren positionsjakt.

---

## 1. Google Search Console — vilken statistik är värd tiden

GSC visar fyra grundmått. Här är vad de betyder i klartext, riktvärde, och vilken åtgärd de triggar.

### De fyra måtten

| Mått | Vad det betyder (kundvänligt) | Bra/dåligt riktvärde | Åtgärd det triggar |
|------|-------------------------------|----------------------|--------------------|
| **Visningar (Impressions)** | Hur många gånger kundens länk dök upp i Googles resultat. "Dök upp" = inte nödvändigtvis sågs. | Trend viktigare än nivå. Stigande = bra. Plötsligt fall = teknisk fråga eller AI Overview äter synlighet. | Fall → kolla indexering/teknik. Noll → sidan finns inte i Google alls (hög brist). |
| **Klick** | Hur många faktiskt klickade in på sajten från Google. | Detta är den siffra som blir besök = potentiella kunder. | Klick ner men visningar stabila → titel/meta säljer dåligt, eller AI Overview snor klicket. |
| **CTR (klickfrekvens)** | Andel av visningar som blev klick (klick ÷ visningar). | Se positionstabell nedan. | Låg CTR vid bra position → skriv om titel + meta description. |
| **Snittposition** | Genomsnittlig placering i resultatlistan för de sökord sidan visas på. | 1–3 = topp. 4–10 = sida 1. 11–20 = sida 2 (nästan inga klick). | Position 11–20 = den största hävstången (se nedan). |

### CTR-riktvärden per position (2026, verifierat)

På en "ren" resultatsida utan AI-block:
- **Position 1: ~35–40 %** (≈39,8 %)
- **Position 2: ~15–20 %** (≈18,7 %)
- **Position 3: ~9–12 %** (≈10,2 %)
- Position 4–10: faller snabbt mot 2–5 %

Källa: [navboost.com](https://navboost.com/ctr-by-position/), [trydecoding.com](https://trydecoding.com/blog/googles-organic-click-through-rate-by-search-position/).

**VIKTIG 2026-justering:** Finns en AI Overview ovanför resultatet halveras CTR ungefär. Position 1 faller från ~27 % till ~11 % (ca −60 %) när AI Overview visas ([seo-kreativ.de](https://www.seo-kreativ.de/en/blog/zero-click-search/), [Ahrefs via contentpowered](https://www.contentpowered.com/blog/good-ctr-search-console/)). Nya normala riktvärden vid AI Overview:
- Är man **citerad** i AI Overview: 18–25 % är ok
- Är man **inte citerad**: 10–18 % är "det nya normala"

Slutsats: bedöm aldrig CTR utan att veta om sökordet triggar en AI Overview.

### Hur man läser tre vanliga mönster

1. **Höga visningar + låg CTR** → Sidan rankar men ingen klickar. Antingen (a) dålig titel/meta som inte säljer, eller (b) AI Overview svarar redan på frågan. Åtgärd: skriv om title + meta description först (billig fix, snabb effekt); om sökordet är informativt och AI svarar → satsa på GEO (sektion 4) i stället.

2. **Position 11–20** → Sidan är "nästan på sida 1". Detta är den HÖGSTA hävstången. Ett kliv från position 12 till 8 kan mångdubbla klicken. Åtgärd: stärk just den sidan (mer innehåll, interna länkar, en bra title). Detta är ofta den bästa upsell-vinkeln för SEO-optimering.

3. **Noll visningar** → Sidan/sajten finns i praktiken inte i Google. Antingen inte indexerad, blockerad i robots, eller helt utan auktoritet. Detta är en HÖG brist (Axonas CRM flaggar redan total Google-osynlighet). Åtgärd: teknisk SEO-genomgång + grundläggande on-page (sektion 3).

### De 3–5 nyckeltal Axona bör rapportera månadsvis

Rapportera **trend (vs förra månaden)**, inte absoluta tal i vakuum:

1. **Klick** — "X personer hittade er via Google" (den enda siffran som direkt kopplar till besök).
2. **Visningar** — "Ni syntes Y gånger" (mätare på räckvidd/synlighet).
3. **Snittposition** — "Ni ligger i snitt på plats Z" (förbättringsbevis).
4. **Top 3–5 queries** — vilka sökord som faktiskt driver klick (kunden känner igen sin verksamhet → ökar upplevt värde).
5. (Valfritt) **Antal queries i position 11–20** — direkt åtgärdslista = nästa månads jobb = nästa faktura.

**Resten är brus för kunden:** datum-för-datum-grafer, enskilda sidors visningar, sökord med 1–2 visningar, "coverage"-detaljer. De är arbetsmaterial för Axona, inte rapportmaterial för kund.

---

## 2. Core Web Vitals & prestanda

Tre mått, mätta på **75:e percentilen av riktiga besökare** (CrUX-data) — alltså 75 % av besökarna måste ha en bra upplevelse för att sidan ska "passera".

### Aktuella tröskelvärden (verifierade juni 2026)

| Mått | Vad det mäter | Bra | Behöver förbättras | Dåligt |
|------|---------------|-----|--------------------|--------|
| **LCP** (Largest Contentful Paint) | Hur snabbt huvudinnehållet (oftast stora bilden/rubriken) syns | < 2,5 s | 2,5–4,0 s | > 4,0 s |
| **INP** (Interaction to Next Paint) | Hur snabbt sidan svarar på klick/tryck (ersatte FID 2024) | < 200 ms | 200–500 ms | > 500 ms |
| **CLS** (Cumulative Layout Shift) | Hur mycket layouten "hoppar" medan sidan laddar | < 0,1 | 0,1–0,25 | > 0,25 |

Källa: [web.dev](https://web.dev/articles/defining-core-web-vitals-thresholds), [corewebvitals.io](https://www.corewebvitals.io/core-web-vitals). Endast ~56 % av alla sajter passerar alla tre (maj 2026 CrUX). **INP är det mest misslyckade måttet** — 43 % av sajter klarar inte 200 ms ([digitalapplied](https://www.digitalapplied.com/blog/core-web-vitals-2026-inp-lcp-cls-optimization-guide)).

### Vad de påverkar — ranking OCH konvertering (med siffror)

- **Ranking:** Med Googles core-uppdatering mars 2026 stärktes prestandans vikt. Sajter som passerar tröskeln ser positionsförbättringar; de som fallerar tappar ([digitalapplied](https://www.digitalapplied.com/blog/core-web-vitals-2026-inp-lcp-cls-optimization-guide)). Prestanda är en tiebreaker, inte huvudfaktorn — men den är gratis poäng.
- **Konvertering (här ligger pengarna):**
  - Från "Poor" till "Good" på alla tre = **+25 % konvertering, −35 % avhopp** ([websitespeedy](https://websitespeedy.com/blog/how-do-core-web-vitals-impact-your-conversion-rates/)).
  - Varje 100 ms snabbare LCP ≈ **1,11 % högre konvertering** (Deloitte/eBay-studie).
  - Renault: −1 s LCP gav **−14 % avhopp, +13 % konvertering**.
  - Sidor med 2 s LCP vs 4–5 s: **40–50 % högre konvertering**.

Pitch-vinkeln till kund är därför aldrig "ni får bättre LCP-score" utan "snabbare sida = fler av era besökare blir kunder".

### Vanligaste fixarna, rangordnade efter effekt/insats

1. **Optimera/komprimera bilder + preload av LCP-bilden** (`fetchpriority="high"`) — störst effekt på LCP, låg insats. (Bilder är oftast LCP-elementet.)
2. **Sätt fasta dimensioner på bilder/annonser/embeds** — fixar CLS direkt, nästan ingen insats.
3. **Skjut upp / ta bort tunga tredjepartsskript** (chatwidgets, analys, annonser) — störst INP-effekt; de äter huvudtråden.
4. **Dela upp lång JavaScript** (tasks > 50 ms blockerar) med yielding/`requestIdleCallback` — förbättrar INP, högre insats.
5. **Kritisk CSS inline + font `display: swap`** — förbättrar LCP, medel insats.

Källa: [digitalapplied](https://www.digitalapplied.com/blog/core-web-vitals-2026-inp-lcp-cls-optimization-guide), [dev.to/benriemer](https://dev.to/benriemer/core-web-vitals-in-2026-the-practical-fixes-for-inp-lcp-and-cls-that-actually-work-4ef0). På en modern Next.js-sajt (Axonas standard) sköts mycket av detta redan av ramverket — bra säljargument: "vi bygger snabbt från grunden".

---

## 3. Teknisk & on-page SEO 2026

Vad varje element gör — och var myten ligger.

| Element | Spelar roll för att... | Myt / nyans 2026 |
|---------|------------------------|-------------------|
| **Title tag** | Påverkar både ranking OCH klick. Det viktigaste enskilda on-page-elementet. | Myt: "längre = bättre". Nej — Google klipper och skriver om dåliga titlar. |
| **Meta description** | **INTE en rankingfaktor** (Google bekräftar sedan 2009, igen 2026). Påverkar bara CTR. | Google **skriver om den 60–87 % av tiden**, mest på position 4–6. Din text används bara ~30 % på sida 1. Skriv den ändå — för de 30 % och som relevanssignal till AI. ([clickrank.ai](https://www.clickrank.ai/meta-description-a-google-ranking-factor/)) |
| **H1** | Hjälper Google + AI förstå sidans ämne. En tydlig H1 per sida. | Myt: "exakt en H1 är ett hårt krav". Bra praxis, men inte rankingavgörande. |
| **sitemap.xml** | Hjälper Google hitta alla sidor (särskilt nya/stora sajter). | Garanterar inte indexering, bara upptäckt. |
| **robots.txt** | Styr vad crawlers får hämta. **2026: styr även AI-crawlers** (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot). | Fälla: blockera AI-crawlers av misstag = försvinner ur AI-svar inom timmar. Kolla detta. |
| **Open Graph** | Styr hur länken ser ut när den delas (sociala medier, chatt). | Ingen direkt SEO-ranking, men påverkar delningsklick. |
| **schema.org** | Hjälper Google visa "rich results" och hjälper AI förstå/citera. | Se nedan — flera typer har slutat ge rich results 2026. |

### schema.org — vilka typer ger faktiskt något 2026

**Ger fortfarande rich results (använd dessa):** `Product`, `Review`/`AggregateRating`, `Article`, `Recipe`, `Video`, `Organization`, `LocalBusiness`, `BreadcrumbList`, `Event` ([digitalapplied](https://www.digitalapplied.com/blog/structured-data-after-io-2026-schema-updates)).

**Slutat ge rich results (bygg inte din pitch på dem):**
- **FAQ** — avvecklat maj 2026. Markup är fortfarande giltig och hjälper AI förstå, men ger **inget SERP-utseende längre**.
- **HowTo** — borta sedan 2023, noll SERP-lyft.
- Sju typer borttagna juni 2025: Book Actions, Course Info, Claim Review, Estimated Salary, Learning Video, Special Announcement, Vehicle Listing.

Källa: [getpassionfruit](https://www.getpassionfruit.com/blog/what-changed-with-google-drops-faq-rich-results-and-what-to-do-now), [searchenginejournal](https://www.searchenginejournal.com/google-is-not-diminishing-the-use-of-structured-data-in-2026/560516/).

**Viktig nyans:** Schema-deprekationerna är *visuella* ändringar, inte algoritmiska. Schema är ingen direkt rankingfaktor — men det gör sajten begriplig för både Google och AI, vilket är värt mer 2026. För lokala svenska SMB är `LocalBusiness` + `Organization` + `Review` de tre som faktiskt ger värde.

---

## 4. GEO/AEO — synlighet i AI-sök (kärnan i modern strategi)

GEO (Generative Engine Optimization) / AEO (Answer Engine Optimization) = att bli **citerad i AI-svar** från ChatGPT, Claude, Gemini, Perplexity och Googles AI Overviews. Detta är 2026 års viktigaste tillväxtområde — AI-söktrafik konverterar enligt mätningar 3x bättre och växer ~527 % år över år ([presenceai](https://presenceai.app/blog/2026-geo-benchmarks-ai-search-traffic-statistics)).

### Hur AI faktiskt hämtar webbinnehåll (avgörande att förstå)

De använder olika index — **att synas i ett betyder inte att synas i ett annat**:
- **ChatGPT** — egen crawler (OAI-SearchBot) + Bing-fallback. Citerar brett mot Wikipedia (~48 % av källor). Citerar varumärken sällan (~0,6 % av svaren).
- **Claude** — kör webbsök på **Brave**. Ranking #1 på Google hjälper inte Claude.
- **Gemini / Google AI Overviews** — läser **Googles index**.
- **Perplexity** — realtidshämtning för varje fråga; nytt innehåll kan citeras inom timmar. Gillar Reddit (~47 % av källor) och färskt innehåll (< 30 dgr = 3,2x citeringar). Citerar varumärken ~13 % av svaren.

Källa: [ai-visibility.org.uk](https://www.ai-visibility.org.uk/blog/how-ai-search-works/), [leapd.ai](https://www.leapd.ai/blog/ai-visibility/how-chatgpt-google-ai-overviews-and-perplexity-source-information-in-2026). De flesta AI-svar är **RAG** (Retrieval-Augmented Generation): modellen hämtar live-passager och syntetiserar — den "vet" inte från träningsdata. Det betyder att färskt, välstrukturerat innehåll faktiskt kan tas upp snabbt.

### Vad som BEVISAT fungerar (Princeton/Georgia Tech/IIT-studien, KDD 2024)

GEO-tekniker kan höja synlighet i AI-svar med **upp till 40 %**. De starkaste metoderna ([enrichlabs](https://www.enrichlabs.ai/blog/generative-engine-optimization-geo-complete-guide-2026), [convertmate](https://www.convertmate.io/research/geo-benchmark-2026)):

1. **Statistik / siffror i texten** — AI citerar gärna konkreta tal.
2. **Citera källor** — länka auktoritativa källor; AI litar på innehåll som självt refererar.
3. **Direkta citat / expertuttalanden** — höjer trovärdighet.
4. **Tydlig struktur** — rubriker, korta stycken, direkta svar högt upp. **44,2 % av alla AI-citeringar kommer från första 30 % av texten** ([Growth Memo via convertmate](https://www.convertmate.io/research/geo-benchmark-2026)) → svara på frågan direkt, inte efter tre stycken intro.
5. **Färskhet** — uppdatera innehåll var ~30:e dag → 3,2x fler citeringar.

### Plausibelt men mindre bevisat
- **"Konsensus över källor"** — AI får förtroende när varumärket nämns konsekvent på Reddit, YouTube, branschsajter, recensionssajter (G2 m.fl.) OCH egna sajten med samma budskap. Bygg närvaro på flera ställen.
- **FAQ-format** (med tydliga fråga/svar-block) hjälper AI även om FAQ-rich-results dog — det handlar om strukturen, inte schemat.

### llms.txt — kritisk granskning (var ärlig mot kund här)

`llms.txt` är en föreslagen fil som ska tala om för AI vad sajten innehåller. **Status juni 2026: i praktiken spekulativt/odött.**
- Det är en **community-konvention, inte en standard** — IETF-standardisering diskuteras men ej levererad.
- **Google säger uttryckligen nej** (Gary Illyes, juli 2025: stöder inte och planerar inte; John Mueller jämförde det med det utdömda keywords-metataggen).
- **OpenAI/Anthropic:** ingen bekräftad konsumtion vid inferens. Viss korrelation observeras men inget bevisat.
- **Hårda datat:** av ~38 000 domäner med giltig llms.txt fick **97 % noll förfrågningar** för filen i maj 2026 ([presenc.ai](https://presenc.ai/research/state-of-llms-txt-2026), [rye.dev](https://rye.dev/blog/llms-txt-standard-elegant-solution-nobody-using/)).

**Axonas linje:** Lägg gärna in en llms.txt — den är gratis och skadar inte — men **sälj den aldrig som en effektiv åtgärd**. Att flagga avsaknad som "brist" i CRM:t är försvarbart som hygien, men i kunddialog: var ärlig om att bevisad effekt saknas. Den verkliga GEO-hävstången ligger i punkt 1–5 ovan + robots.txt som *släpper in* rätt AI-crawlers.

---

## 5. Lokal SEO & Google Business-profil

För lokala svenska SMB (Axonas typiska kund) är detta **ofta högst ROI** — lägre konkurrens, snabbare resultat, och direkt koppling till "ring/besök oss".

### Rankingfaktorer (Googles tre, fortsatt 2026)

1. **Relevans** — matchar profilen sökningen?
   - **Primär kategori är #1-faktorn** i 2026 års Local Search Ranking Factors-undersökning. Välj den *smalaste korrekta* kategorin (t.ex. "Personskadeadvokat" slår "Advokatbyrå").
2. **Närhet (proximity)** — avstånd till sökaren. Går ej att ändra, men serviceområden kan listas.
3. **Prominens** — hur känt/betrott företaget är: recensioner, omnämnanden, citeringar (NAP: namn/adress/telefon konsekvent), länkar.

Källa: [brightlocal](https://www.brightlocal.com/learn/google-local-algorithm-and-ranking-factors/), [localmighty](https://www.localmighty.com/blog/google-business-profile-ranking-factors/).

### Recensionsstrategi (det mest påverkbara)

- **Jämn ström slår engångsboost.** En stadig takt över 90 dagar rankar bättre än 50 recensioner på en gång följt av tystnad. **Recensionsfärskhet** vägde tyngre 2026.
- Google väger: antal, snittbetyg, **sentiment, nyckelord i texten, recensentens auktoritet, och ägarens svar**. → Svara alltid på recensioner.
- Praktiskt: bygg en enkel rutin (QR-kod/SMS-länk efter avslutat jobb) som ger ~2–4 nya recensioner/månad.

Axonas CRM hämtar redan rating + antal recensioner via Places. Lågt antal eller stagnerande recensioner = tydlig brist → "Google Business-paket".

---

## 6. Axona upsell-spelbok

Varje vanlig brist → kundvänlig mening → tjänstepaket → pitch-vinkel.

| Brist (från CRM-analysen) | Förklaring kunden förstår (en mening) | Tjänstepaket | Pitch-vinkel |
|---------------------------|----------------------------------------|--------------|--------------|
| Långsam sida / dålig LCP/INP/CLS | "Er sida laddar långsamt — och varje sekund kostar er kunder." | **Prestandaoptimering** | "Vi gör sidan snabbare. Renault tappade 14 % färre besökare av 1 sek snabbare — det är fler bokningar för er." |
| Saknar/dålig title & meta | "När ni dyker upp på Google syns inget som lockar folk att klicka." | **SEO-optimering** | "Ni rankar redan — men ingen klickar. Vi skriver om rubrikerna så fler väljer er." |
| Position 11–20 på bra sökord | "Ni ligger på Googles sida 2 — där knappt någon tittar — fast ni är nära sida 1." | **SEO-optimering** | "Ni är fem steg från förstasidan på [sökord]. Det här är den snabbaste vinsten ni kan göra." |
| Noll Google-synlighet | "Er sajt finns i praktiken inte på Google." | **SEO-optimering** + **Innehåll & synlighet** | "Era kunder googlar er tjänst men hittar konkurrenterna. Vi sätter er på kartan." |
| Saknar schema/struktur, tunt innehåll | "Google och AI förstår inte riktigt vad ni erbjuder." | **Innehåll & synlighet** | "Vi gör innehållet begripligt för både Google och AI — så ni dyker upp där folk frågar." |
| Citeras inte i AI-svar | "När folk frågar ChatGPT/Google AI om er bransch nämns ni aldrig." | **AI-sök-optimering** | "Sökning flyttar till AI. Vi ser till att ni blir svaret AI ger — inte konkurrenten." |
| Lågt/stagnerande recensionsantal | "Ni har för få och för gamla recensioner — Google litar mer på företag med färska." | **Google Business-paket** | "Vi bygger en rutin som ger er jämn ström av recensioner — det lyfter er i kartan och bygger förtroende." |

### Återkommande rapport-abonnemang (= återkommande intäkt)

Ett **månads-/kvartalsabonnemang** ("Synlighetsabonnemang") med mätbart kundvärde:

- **Månatlig statistikrapport** (mallen i sektion 7) — klick, visningar, position, top-queries, trend.
- **Core Web Vitals-bevakning** — larm om sidan blir långsam.
- **Recensionsbevakning + svarsmallar** — håller GBP färsk.
- **1 åtgärd/månad** — ett konkret förbättringsjobb (skriv om en title, optimera en bild, nytt innehållsstycke för AI-citering).
- **Kvartalsvis GEO-koll** — syns ni i ChatGPT/Perplexity/AI Overviews på era nyckelfrågor?

Säljlogiken: rapporten gör värdet *synligt* varje månad → låg churn → varje "1 åtgärd" är nästa månads jobb redan betalt.

---

## 7. Mall för månatligt kundutskick

**Mejlstruktur — håll det till 4–6 siffror, allt icke-tekniskt.**

> **Ämne:** Er synlighet i [månad] — [företagsnamn]
>
> Hej [namn],
>
> Här är hur ni syntes på Google den senaste månaden:
>
> - 👁️ **Ni syntes [visningar] gånger** i Googles sökresultat *([↑/↓ X % mot förra månaden])*
> - 🖱️ **[klick] personer klickade in** på er sajt *([↑/↓ X %])*
> - 📍 **Ni låg i snitt på plats [position]** *([↑/↓ X platser] — ju lägre tal desto bättre)*
> - 🔍 **De sökord som gav er flest besök:** [query 1], [query 2], [query 3]
> - ⚡ (om relevant) **Er sida laddar på [X sek]** — [grönt: snabbt nog / gult: kan bli bättre]
>
> **Vad vi rekommenderar härnäst:**
> [En mening, kopplat till en upsell-vinkel. T.ex.: "Ni ligger på plats 12 för '[sökord]' — fem steg från förstasidan. Med en SEO-insats kan vi lyfta er dit. Vill ni att vi kör?"]
>
> Hör av er om ni vill prata igenom siffrorna.
> /Axona

**Regler för mallen:**
- **Alltid trend, aldrig naket tal** — "300 klick" säger inget; "300 klick, +18 %" säger allt.
- **Förklara position en gång** ("ju lägre desto bättre") — kunder läser det fel annars.
- **Exakt en rekommenderad åtgärd** per utskick — för många val = ingen åtgärd.
- **Inga GSC-screenshots, inga grafer med 30 datapunkter, inga sökord med < 5 visningar.** Det är Axonas arbetsmaterial, inte kundens.
- Koppla alltid åtgärden till ett paket från sektion 6.

---

## Källor (urval)

- Zero-click / AI Overviews: [SparkToro](https://sparktoro.com/blog/in-2026-less-than-one-third-of-google-searches-still-send-a-click/), [SeoProfy](https://seoprofy.com/blog/google-ai-overviews/), [seo-kreativ.de](https://www.seo-kreativ.de/en/blog/zero-click-search/)
- Core Web Vitals: [web.dev](https://web.dev/articles/defining-core-web-vitals-thresholds), [corewebvitals.io](https://www.corewebvitals.io/core-web-vitals), [digitalapplied](https://www.digitalapplied.com/blog/core-web-vitals-2026-inp-lcp-cls-optimization-guide)
- CWV konvertering: [websitespeedy](https://websitespeedy.com/blog/how-do-core-web-vitals-impact-your-conversion-rates/)
- CTR per position: [navboost.com](https://navboost.com/ctr-by-position/), [trydecoding.com](https://trydecoding.com/blog/googles-organic-click-through-rate-by-search-position/), [contentpowered](https://www.contentpowered.com/blog/good-ctr-search-console/)
- Meta description: [clickrank.ai](https://www.clickrank.ai/meta-description-a-google-ranking-factor/)
- Schema 2026: [getpassionfruit](https://www.getpassionfruit.com/blog/what-changed-with-google-drops-faq-rich-results-and-what-to-do-now), [searchenginejournal](https://www.searchenginejournal.com/google-is-not-diminishing-the-use-of-structured-data-in-2026/560516/), [digitalapplied](https://www.digitalapplied.com/blog/structured-data-after-io-2026-schema-updates)
- AI-retrieval & GEO: [ai-visibility.org.uk](https://www.ai-visibility.org.uk/blog/how-ai-search-works/), [leapd.ai](https://www.leapd.ai/blog/ai-visibility/how-chatgpt-google-ai-overviews-and-perplexity-source-information-in-2026), [enrichlabs](https://www.enrichlabs.ai/blog/generative-engine-optimization-geo-complete-guide-2026), [convertmate](https://www.convertmate.io/research/geo-benchmark-2026)
- llms.txt: [presenc.ai](https://presenc.ai/research/state-of-llms-txt-2026), [rye.dev](https://rye.dev/blog/llms-txt-standard-elegant-solution-nobody-using/), [ahrefs](https://ahrefs.com/blog/what-is-llms-txt/)
- Lokal SEO/GBP: [brightlocal](https://www.brightlocal.com/learn/google-local-algorithm-and-ranking-factors/), [localmighty](https://www.localmighty.com/blog/google-business-profile-ranking-factors/)
</content>
</invoke>
