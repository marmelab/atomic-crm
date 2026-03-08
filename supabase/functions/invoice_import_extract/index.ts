import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { GoogleGenAI, createPartFromBase64 } from "npm:@google/genai";

import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import {
  invoiceImportResponseJsonSchema,
  parseInvoiceImportModelResponse,
  validateInvoiceImportExtractPayload,
} from "../_shared/invoiceImportExtract.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";

const geminiApiKey =
  Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_API_KEY") ?? "";
const allowedModels = new Set(["gemini-2.5-pro", "gemini-2.5-flash"]);

const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

const buildPrompt = ({
  userInstructions,
  clients,
  projects,
}: {
  userInstructions?: string | null;
  clients: Array<{
    id: string;
    name: string;
    email: string | null;
    billing_name: string | null;
    vat_number: string | null;
    fiscal_code: string | null;
    billing_city: string | null;
  }>;
  projects: Array<{ id: string; name: string; client_id: string }>;
}) =>
  `
Data odierna: ${new Date().toISOString().slice(0, 10)}.

Sei l'assistente AI unificato del CRM Rosario Furnari.
Devi leggere i documenti allegati (fatture PDF digitali, scansioni o foto) e proporre dati strutturati da importare nel CRM.

REGOLA FONDAMENTALE: se un documento contiene una tabella o un elenco con piu' righe (es. 9 spot, 5 servizi, 3 pagamenti), DEVI produrre un record separato per ciascuna riga nell'array \`records\`. Mai raggruppare piu' righe in un singolo record. Il numero di record deve corrispondere al numero di righe nel documento.

REGOLA CLASSIFICAZIONE — la piu' importante:
- Il titolare del CRM ha P.IVA 01309870861 (Rosario Furnari)
- Se il documento e' EMESSO dal titolare (cedente/prestatore con P.IVA 01309870861) → \`resource = "payments"\` (e' un incasso atteso)
- Se il documento e' RICEVUTO dal titolare (cessionario/committente con P.IVA 01309870861, oppure il cedente e' un altro soggetto) → \`resource = "expenses"\` (e' un costo)
- Se il documento e' un riepilogo lavori/prestazioni svolte dal titolare → \`resource = "services"\`
- In caso di dubbio, guarda chi e' il cedente/prestatore: se e' il titolare e' un incasso, se e' un altro e' una spesa

REGOLA IMPORTI:
- Usa SEMPRE l'importo IMPONIBILE (netto, senza IVA) come \`amount\`, non il lordo
- Il CRM gestisce importi netti; l'IVA viene calcolata separatamente dal sistema fiscale
- Se il documento mostra solo il totale lordo con aliquota IVA, calcola l'imponibile (es. lordo 122 con IVA 22% → amount = 100)
- Per regime forfettario (senza IVA esposta), usa l'importo come indicato

REGOLA MATCH CLIENTE:
- Confronta PRIMA la partita IVA o il codice fiscale del documento con quelli dei clienti CRM — il match su P.IVA/CF e' quasi sempre corretto
- Solo se P.IVA e CF non sono presenti o non matchano, prova il match per nome (tollerando variazioni tipo "Ass." vs "Associazione", "S.r.l." vs "Srl")
- Se il match per nome non e' sicuro al 90%, lascia \`clientId = null\` e spiega in \`rationale\`

Regole di mapping obbligatorie:
- usa \`resource = "payments"\` se il documento rappresenta soldi che il CRM deve incassare da un cliente (fattura emessa, ricevuta incasso)
- usa \`resource = "expenses"\` se il documento rappresenta una spesa, fattura fornitore o costo sostenuto
- usa \`resource = "services"\` se il documento e' un riepilogo di lavori/servizi/prestazioni eseguite (es. elenco spot, schede lavoro, notule di prestazione). REGOLA CRITICA: se il documento contiene una tabella con N righe di servizi/lavori, DEVI produrre N record separati nell'array records — uno per ogni riga della tabella. Non raggruppare, non sommare, non creare un singolo record riassuntivo. Ogni riga = un record. Per ciascun record:
  - \`description\`: breve titolo/nome del servizio dalla riga (es. "Spot Ricotta — Pierpaolo", "Spot Keste Store")
  - \`documentDate\`: la data REALE in cui il servizio e' stato svolto (YYYY-MM-DD), letta dalla riga della tabella. ATTENZIONE: NON usare la data di emissione/intestazione del documento; ogni servizio ha la propria data di svolgimento nella tabella e quella e' il valore corretto per \`documentDate\`
  - \`amount\`: il compenso della singola riga, NON il totale del documento
  - valorizza \`serviceType\` tra: "riprese", "montaggio", "riprese_montaggio", "fotografia", "sviluppo_web", "altro"
  - valorizza \`isTaxable\` (true se tassabile, false se esente/fuori campo)
  - valorizza \`location\` con la localita' del servizio se leggibile
  - se il tipo e' chiaramente solo riprese usa \`feeShooting = amount\`, se solo montaggio usa \`feeEditing = amount\`, se misto distribuisci tra \`feeShooting\` e \`feeEditing\`, altrimenti usa \`feeOther\`
  - \`serviceEnd\` (YYYY-MM-DD) se il servizio copre un periodo, altrimenti null
  - \`allDay\` true se e' una giornata intera, null se non deducibile
  - \`discount\` se il documento indica uno sconto, altrimenti null
  - \`kmDistance\` e \`kmRate\` se il documento indica km di trasferta, altrimenti null
  - \`notes\`: annotazioni operative o dettagli aggiuntivi leggibili dal documento (es. "Inclusa selezione e invio immagini"), null se assente o generico ("—")
- non inventare mai clienti o progetti nuovi
- puoi valorizzare \`clientId\` o \`projectId\` solo usando questi ID esatti del CRM
- se un match non è affidabile, lascia il relativo ID a null e spiega il dubbio in \`warnings\` o \`rationale\`
- non produrre testo fuori dallo schema JSON richiesto
- usa EUR come currency quando non c'e' una valuta diversa esplicita
- per i pagamenti, se non è chiaro che il denaro sia già entrato usa \`paymentStatus = "in_attesa"\`
- per i pagamenti, usa di default \`paymentType = "saldo"\` salvo segnali chiari di acconto/parziale/rimborso
- per le spese, valorizza \`expenseType\` scegliendo tra:
  - "spostamento_km": rimborso chilometrico per trasferta
  - "pedaggio_autostradale": caselli, Telepass, pedaggi autostradali
  - "vitto_alloggio": pranzo, cena, hotel, pernottamento, ristorante, bar
  - "acquisto_materiale": hard disk, cavi, accessori, attrezzatura comprata
  - "abbonamento_software": Claude, Adobe, hosting, domini, SaaS, licenze software ricorrenti
  - "noleggio": noleggio attrezzatura (droni, luci, auto)
  - "credito_ricevuto": bene o sconto ricevuto dal cliente
  - "altro": se nessuna delle precedenti e' adatta
  Se non e' chiaro, usa "acquisto_materiale" come default
- \`documentDate\` e \`dueDate\` devono essere in formato YYYY-MM-DD se leggibili
- quando il documento contiene un'anagrafica fiscale leggibile, valorizza anche:
  - \`billingName\`
  - \`vatNumber\`
  - \`fiscalCode\`
  - \`billingAddressStreet\`
  - \`billingAddressNumber\`
  - \`billingPostalCode\`
  - \`billingCity\`
  - \`billingProvince\`
  - \`billingCountry\`
  - \`billingSdiCode\`
  - \`billingPec\`
- non inventare mai quei campi: se non sono leggibili, lasciali a null
- usa \`counterpartyName\` come nome principale leggibile nel documento e
  \`billingName\` come denominazione fiscale quando disponibile
- il match cliente e' piu affidabile se coincidono denominazione, partita IVA
  o codice fiscale con un cliente CRM esistente
- se nel documento compare una persona referente ma l'intestazione fiscale
  appartiene a un'azienda o associazione, considera cliente la controparte
  fiscale e non il referente

CRM clients disponibili:
${JSON.stringify(clients, null, 2)}

CRM projects disponibili:
${JSON.stringify(projects, null, 2)}

Istruzioni aggiuntive utente:
${userInstructions?.trim() || "Nessuna istruzione aggiuntiva"}
`.trim();

async function extractInvoiceImportDraft(
  req: Request,
  currentUserSale: unknown,
) {
  if (!currentUserSale) {
    return createErrorResponse(401, "Unauthorized");
  }

  if (!geminiApiKey || !ai) {
    return createErrorResponse(
      500,
      "GEMINI_API_KEY non configurata nelle Edge Functions",
    );
  }

  const payload = await req.json();
  const validation = validateInvoiceImportExtractPayload(payload);
  if (validation.error || !validation.data) {
    return createErrorResponse(400, validation.error ?? "Payload non valido");
  }

  const selectedModel = allowedModels.has(validation.data.model)
    ? validation.data.model
    : "gemini-2.5-pro";

  const cleanupPaths = validation.data.files.map((file) => file.path);

  try {
    const [clientsResponse, projectsResponse] = await Promise.all([
      supabaseAdmin
        .from("clients")
        .select(
          "id,name,email,billing_name,vat_number,fiscal_code,billing_city",
        )
        .order("name", { ascending: true })
        .limit(1000),
      supabaseAdmin
        .from("projects")
        .select("id,name,client_id")
        .order("name", { ascending: true })
        .limit(1000),
    ]);

    if (clientsResponse.error) {
      throw clientsResponse.error;
    }
    if (projectsResponse.error) {
      throw projectsResponse.error;
    }

    const fileParts = [];
    for (const file of validation.data.files) {
      const downloaded = await supabaseAdmin.storage
        .from("attachments")
        .download(file.path);

      if (downloaded.error || !downloaded.data) {
        throw (
          downloaded.error ?? new Error(`File non disponibile: ${file.name}`)
        );
      }

      const base64 = arrayBufferToBase64(await downloaded.data.arrayBuffer());
      fileParts.push(createPartFromBase64(base64, file.mimeType));
    }

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: [
        {
          role: "user",
          parts: [
            ...fileParts,
            {
              text: buildPrompt({
                userInstructions: validation.data.userInstructions,
                clients: clientsResponse.data ?? [],
                projects: projectsResponse.data ?? [],
              }),
            },
          ],
        },
      ],
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseJsonSchema: invoiceImportResponseJsonSchema,
      },
    });

    const responseText = response.text?.trim();
    if (!responseText) {
      return createErrorResponse(
        502,
        "Gemini ha restituito una risposta vuota sull'estrazione fatture",
      );
    }

    const draft = parseInvoiceImportModelResponse({
      responseText,
      model: selectedModel,
    });

    return new Response(JSON.stringify({ data: draft }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("invoice_import_extract.error", error);
    return createErrorResponse(
      500,
      "Impossibile estrarre i dati fattura nella chat AI",
    );
  } finally {
    if (cleanupPaths.length > 0) {
      await supabaseAdmin.storage.from("attachments").remove(cleanupPaths);
    }
  }
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (request) =>
    AuthMiddleware(request, async (authedRequest) =>
      UserMiddleware(authedRequest, async (_, user) => {
        const currentUserSale = user ? await getUserSale(user) : null;
        if (!currentUserSale) {
          return createErrorResponse(401, "Unauthorized");
        }

        if (authedRequest.method === "POST") {
          return extractInvoiceImportDraft(authedRequest, currentUserSale);
        }

        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  ),
);
