#!/usr/bin/env node
/**
 * mint-gsc-token.mjs — engångsskript för att skapa en HÅLLBAR refresh-token
 * till Google Search Console (analyze_website-funktionen).
 *
 * BAKGRUND: Den gamla GSC-credentialen skapades med `gcloud auth
 * application-default login`. Sådana credentials lyder under Workspace-policyn
 * "Google Cloud session control" och tvingas reautentisera → token-bytet failar
 * med `invalid_grant / invalid_rapt`. Det här skriptet mintar i stället en
 * refresh-token från en RIKTIG OAuth-klient (samma som calendar_sync redan
 * använder), vilket INTE lyder under den policyn → token håller i månader.
 *
 * Resultatet skrivs ut som ett JSON i `authorized_user`-format som du klistrar
 * rakt in i Supabase-secreten GSC_GOOGLE_CREDENTIALS. Ingen kodändring behövs —
 * analyze_website läser redan det formatet.
 *
 * KÖR SÅ HÄR (inloggad i en webbläsare som info@axonadigital.se):
 *
 *   GOOGLE_OAUTH_CLIENT_ID=...  GOOGLE_OAUTH_CLIENT_SECRET=...  \
 *     node scripts/mint-gsc-token.mjs
 *
 * Saknar du miljövariablerna frågar skriptet efter dem interaktivt. Värdena är
 * samma client_id/secret som finns i Supabase-secrets (calendar_sync-klienten).
 *
 * Kräver Node 18+ (global fetch). Inga npm-beroenden.
 */

import http from "node:http";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

// Loopback-redirect. För en "Desktop"-OAuth-klient godkänner Google valfri
// localhost-port automatiskt. Är klienten av "Web"-typ måste exakt denna URI
// läggas till under "Authorized redirect URIs" på klienten i GCP-konsolen.
const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

async function prompt(question) {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function getCredentials() {
  let clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  let clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId) clientId = await prompt("GOOGLE_OAUTH_CLIENT_ID: ");
  if (!clientSecret)
    clientSecret = await prompt("GOOGLE_OAUTH_CLIENT_SECRET: ");
  if (!clientId || !clientSecret) {
    console.error("\n❌ client_id och client_secret krävs. Avbryter.");
    process.exit(1);
  }
  return { clientId, clientSecret };
}

function buildAuthUrl(clientId) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE);
  // offline + consent => Google returnerar ALLTID en refresh_token, även om
  // kontot redan gett samtycke tidigare.
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

/** Startar en localhost-server och väntar på OAuth-callbacken med ?code=. */
function waitForCode() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
      if (reqUrl.pathname !== "/oauth2callback") {
        res.writeHead(404).end();
        return;
      }
      const code = reqUrl.searchParams.get("code");
      const error = reqUrl.searchParams.get("error");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        `<html><body style="font-family:sans-serif;padding:40px">
         <h2>${code ? "✅ Klart!" : "❌ Något gick fel"}</h2>
         <p>${code ? "Du kan stänga den här fliken och gå tillbaka till terminalen." : `Fel: ${error}`}</p>
         </body></html>`,
      );
      server.close();
      if (code) resolve(code);
      else reject(new Error(`OAuth-fel: ${error}`));
    });
    server.listen(PORT, () => {});
    server.on("error", reject);
  });
}

async function exchangeCodeForToken(code, clientId, clientSecret) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Token-byte failade: ${JSON.stringify(data, null, 2)}`);
  }
  return data;
}

async function main() {
  const { clientId, clientSecret } = await getCredentials();
  const authUrl = buildAuthUrl(clientId);

  console.log("\n────────────────────────────────────────────────────────");
  console.log("1. Öppna denna URL i en webbläsare där du är inloggad som");
  console.log("   info@axonadigital.se (kontot som ser GSC-propertyna):\n");
  console.log(`   ${authUrl}\n`);
  console.log("2. Godkänn åtkomsten. Du skickas tillbaka hit automatiskt.");
  console.log("────────────────────────────────────────────────────────\n");
  console.log("⏳ Väntar på callback...");

  const code = await waitForCode();
  const token = await exchangeCodeForToken(code, clientId, clientSecret);

  if (!token.refresh_token) {
    console.error(
      "\n❌ Ingen refresh_token returnerades. Kör om — om problemet kvarstår, " +
        "återkalla appens åtkomst på https://myaccount.google.com/permissions och försök igen.",
    );
    process.exit(1);
  }

  // authorized_user-format som analyze_website/getGoogleAccessToken läser.
  // INGEN quota_project_id — den behövs bara för gcloud-ADC-credentials.
  const credential = {
    type: "authorized_user",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: token.refresh_token,
  };

  console.log("\n✅ Klart! Klistra in följande som värdet på Supabase-secreten");
  console.log("   GSC_GOOGLE_CREDENTIALS (en rad):\n");
  console.log(JSON.stringify(credential));
  console.log(
    "\nSätt den med:\n" +
      "   npx supabase secrets set GSC_GOOGLE_CREDENTIALS='<klistra in JSON ovan>' \\\n" +
      "     --project-ref hgyusrlrzdahucljvqsz\n",
  );
  console.log(
    "Klicka sedan 'Uppdatera statistik' på en kund vars sajt finns i Search Console.",
  );
}

main().catch((err) => {
  console.error("\n❌ Fel:", err.message);
  process.exit(1);
});
