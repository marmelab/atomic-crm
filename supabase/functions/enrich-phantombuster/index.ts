import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { AuthMiddleware } from "../_shared/authentication.ts";

const PB_BASE = "https://api.phantombuster.com/api/v2";

async function handler(req: Request): Promise<Response> {
  const apiKey = Deno.env.get("PHANTOMBUSTER_API_KEY");
  if (!apiKey) {
    console.error("[enrich-phantombuster] PHANTOMBUSTER_API_KEY secret is not set");
    return new Response(
      JSON.stringify({ error: "PHANTOMBUSTER_API_KEY not configured" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  let body: { linkedinUrl: string; agentId: string };
  try {
    body = await req.json();
  } catch (e) {
    console.error("[enrich-phantombuster] Failed to parse request body:", e);
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const { linkedinUrl, agentId } = body;

  if (!linkedinUrl || !agentId) {
    console.warn("[enrich-phantombuster] Missing linkedinUrl or agentId");
    return new Response(
      JSON.stringify({ error: "linkedinUrl and agentId are required" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  console.log("[enrich-phantombuster] Launching agent:", agentId, "for", linkedinUrl);

  // Step 1: Launch the phantom
  const launchRes = await fetch(`${PB_BASE}/agents/launch`, {
    method: "POST",
    headers: {
      "X-Phantombuster-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: agentId,
      argument: {
        spreadsheetUrl: linkedinUrl,
        numberOfLinesPerLaunch: 1,
      },
    }),
  });

  if (!launchRes.ok) {
    const text = await launchRes.text();
    console.error(`[enrich-phantombuster] Launch error ${launchRes.status}:`, text);
    return new Response(
      JSON.stringify({
        error: `PhantomBuster launch error: ${launchRes.status}`,
        detail: text,
      }),
      {
        status: launchRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const { containerId } = await launchRes.json();
  console.log("[enrich-phantombuster] Container launched:", containerId);

  // Step 2: Poll for completion (max 60s, every 5s)
  let result = null;
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 5000));

    const pollRes = await fetch(
      `${PB_BASE}/containers/fetch-result-object?id=${containerId}`,
      { headers: { "X-Phantombuster-Key": apiKey } },
    );

    if (!pollRes.ok) {
      console.warn(`[enrich-phantombuster] Poll ${i + 1} failed: ${pollRes.status}`);
      continue;
    }

    const pollData = await pollRes.json();
    console.log(`[enrich-phantombuster] Poll ${i + 1} status:`, pollData.status);
    if (pollData.status === "finished" || pollData.status === "error") {
      result = pollData;
      break;
    }
  }

  if (!result) {
    console.error("[enrich-phantombuster] Timeout after 60s waiting for container:", containerId);
    return new Response(
      JSON.stringify({ error: "Timeout waiting for PhantomBuster result" }),
      {
        status: 504,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (result.status === "error") {
    console.error("[enrich-phantombuster] Agent failed:", result);
    return new Response(
      JSON.stringify({ error: "PhantomBuster agent failed", detail: result }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Step 3: Fetch output JSON
  const outputRes = await fetch(
    `${PB_BASE}/agents/fetch-output?id=${agentId}`,
    { headers: { "X-Phantombuster-Key": apiKey } },
  );

  if (!outputRes.ok) {
    console.error(`[enrich-phantombuster] Fetch output error ${outputRes.status}`);
    return new Response(
      JSON.stringify({ error: "Failed to fetch agent output" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const outputData = await outputRes.json();
  // outputData.output is a signed S3 URL to the JSON result
  const s3Url = outputData.output;
  if (!s3Url) {
    console.error("[enrich-phantombuster] No S3 output URL in response:", outputData);
    return new Response(
      JSON.stringify({ error: "No output URL in response" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const s3Res = await fetch(s3Url);
  if (!s3Res.ok) {
    console.error(`[enrich-phantombuster] S3 fetch error ${s3Res.status}`);
    return new Response(
      JSON.stringify({ error: "Failed to fetch S3 result" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const companies: PhantomCompany[] = await s3Res.json();
  const company = companies.at(0);
  if (!company) {
    console.warn("[enrich-phantombuster] S3 result returned empty array");
    return new Response(JSON.stringify({ error: "No company data found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[enrich-phantombuster] Success:", company.name);
  return new Response(
    JSON.stringify({
      name: company.name,
      description: company.description,
      website: company.website,
      industry: company.industry,
      size: company.staffCount ?? company.staffCountRange?.start,
      logo: company.logo,
      headquarters: company.headquarter,
      specialities: company.specialities,
      linkedinUrl: company.companyUrl,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

interface PhantomCompany {
  name?: string;
  description?: string;
  website?: string;
  industry?: string;
  staffCount?: number;
  staffCountRange?: { start: number; end: number };
  logo?: string;
  headquarter?: { city?: string; country?: string; postalCode?: string };
  specialities?: string[];
  companyUrl?: string;
}

Deno.serve((req) =>
  OptionsMiddleware(req, (req) => AuthMiddleware(req, handler)),
);
