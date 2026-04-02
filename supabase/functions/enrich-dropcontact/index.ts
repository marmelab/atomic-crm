import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { AuthMiddleware } from "../_shared/authentication.ts";

const DC_BASE = "https://api.dropcontact.io";

async function handler(req: Request): Promise<Response> {
  const body = await req.json();
  const { apiKey, type, data } = body as {
    apiKey: string;
    type: "contact" | "company";
    data: Record<string, string | undefined>;
  };

  if (!apiKey) {
    return json({ error: "apiKey is required" }, 400);
  }
  if (!type || !data) {
    return json({ error: "type and data are required" }, 400);
  }

  // Build the DropContact batch request
  const dcData =
    type === "contact"
      ? [
          {
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email,
            company: data.company_name,
          },
        ]
      : [{ company: data.name, website: data.website }];

  // Step 1: Submit enrichment request
  const submitRes = await fetch(`${DC_BASE}/batch`, {
    method: "POST",
    headers: {
      "X-Access-Token": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: dcData, siren: true }),
  });

  if (!submitRes.ok) {
    const text = await submitRes.text();
    return json(
      { error: `Dropcontact error: ${submitRes.status}`, detail: text },
      submitRes.status,
    );
  }

  const submitData = await submitRes.json();

  if (submitData.error) {
    return json({ error: submitData.error }, 400);
  }

  // If already finished (credits-based sync response)
  if (submitData.success && submitData.data) {
    return json(mapResult(submitData.data[0] ?? {}, type));
  }

  const requestId: string = submitData.request_id;
  if (!requestId) {
    return json({ error: "No request_id returned by Dropcontact" }, 500);
  }

  // Step 2: Poll for result (max 60s, every 5s)
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 5000));

    const pollRes = await fetch(`${DC_BASE}/batch/${requestId}`, {
      headers: { "X-Access-Token": apiKey },
    });

    if (!pollRes.ok) continue;

    const pollData = await pollRes.json();

    if (pollData.error) {
      return json({ error: pollData.error }, 400);
    }

    if (pollData.success && pollData.data) {
      return json(mapResult(pollData.data[0] ?? {}, type));
    }
  }

  return json({ error: "Timeout waiting for Dropcontact result" }, 504);
}

type DCRow = {
  email?: Array<{ email?: string; qualification?: string }>;
  phone?: Array<{ number?: string; type?: string }>;
  mobile_phone?: Array<{ number?: string }>;
  linkedin?: string;
  civility?: string;
  first_name?: string;
  last_name?: string;
  job?: Array<{ job_title?: string }>;
  company?: string;
  siren?: string;
  siret?: string;
  website?: string;
  nb_employees?: string;
  company_address?: string;
  company_zip?: string;
  company_city?: string;
  company_country?: string;
};

function mapResult(row: DCRow, type: "contact" | "company") {
  if (type === "contact") {
    const proEmail =
      row.email?.find((e) => e.qualification === "professional")?.email ??
      row.email?.[0]?.email;
    const phone = row.phone?.[0]?.number ?? row.mobile_phone?.[0]?.number;
    return {
      email: proEmail,
      phone,
      linkedin_url: row.linkedin,
      job_title: row.job?.[0]?.job_title,
      company_name: row.company,
      siren: row.siren,
      siret: row.siret,
    };
  }

  // company
  return {
    siren: row.siren,
    siret: row.siret,
    website: row.website,
    nb_employees: row.nb_employees,
    address: row.company_address,
    zipcode: row.company_zip,
    city: row.company_city,
    country: row.company_country,
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve((req) =>
  OptionsMiddleware(req, (req) => AuthMiddleware(req, handler)),
);
