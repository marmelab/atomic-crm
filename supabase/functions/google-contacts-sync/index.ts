import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import { googleFetch } from "../_shared/googleAuth.ts";

const PEOPLE_API_BASE = "https://people.googleapis.com/v1";

interface GooglePerson {
  resourceName: string;
  etag: string;
  names?: Array<{ displayName: string; givenName?: string; familyName?: string }>;
  emailAddresses?: Array<{ value: string; type?: string }>;
  phoneNumbers?: Array<{ value: string; type?: string }>;
  organizations?: Array<{ name?: string; title?: string }>;
  photos?: Array<{ url: string }>;
}

async function syncContacts(userId: string, salesId: number) {
  // Fetch Google Contacts
  const params = new URLSearchParams({
    personFields: "names,emailAddresses,phoneNumbers,organizations,photos",
    pageSize: "100",
    sortOrder: "LAST_MODIFIED_DESCENDING",
  });

  let allContacts: GooglePerson[] = [];
  let nextPageToken: string | undefined;

  // Paginate through all contacts (max 500 for now)
  for (let page = 0; page < 5; page++) {
    const url = `${PEOPLE_API_BASE}/people/me/connections?${params}${
      nextPageToken ? `&pageToken=${nextPageToken}` : ""
    }`;

    const response = await googleFetch(userId, url);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error("People API error:", response.status, errorBody);
      throw new Error(`People API error: ${response.status}`);
    }

    const data = await response.json();
    const connections: GooglePerson[] = data.connections ?? [];
    allContacts = [...allContacts, ...connections];

    nextPageToken = data.nextPageToken;
    if (!nextPageToken) break;
  }

  // Filter contacts that have at least one email
  const contactsWithEmail = allContacts.filter(
    (c) => c.emailAddresses?.length,
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const googleContact of contactsWithEmail) {
    const emails =
      googleContact.emailAddresses?.map((e) => e.value.toLowerCase()) ?? [];
    const name = googleContact.names?.[0];
    const org = googleContact.organizations?.[0];

    // Try to find existing CRM contact by email
    const { data: existingContacts } = await supabaseAdmin
      .from("contacts")
      .select("id, email_jsonb")
      .or(
        emails.map((email) => `email_jsonb.cs.[{"email":"${email}"}]`).join(","),
      )
      .limit(1);

    if (existingContacts && existingContacts.length > 0) {
      // Contact already exists in CRM, skip (don't overwrite CRM data)
      skipped++;
      continue;
    }

    // Create new contact in CRM
    const emailJsonb = googleContact.emailAddresses?.map((e) => ({
      email: e.value,
      type: e.type === "home" ? "Home" : "Work",
    })) ?? [];

    const phoneJsonb = googleContact.phoneNumbers?.map((p) => ({
      number: p.value,
      type: p.type === "home" ? "Home" : "Work",
    })) ?? [];

    const { error } = await supabaseAdmin.from("contacts").insert({
      first_name: name?.givenName ?? name?.displayName ?? "Inconnu",
      last_name: name?.familyName ?? "",
      title: org?.title ?? "",
      email_jsonb: emailJsonb,
      phone_jsonb: phoneJsonb,
      sales_id: salesId,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      status: "cold",
      has_newsletter: false,
    });

    if (error) {
      console.error("Error creating contact:", error);
      skipped++;
    } else {
      created++;
    }
  }

  return {
    total: contactsWithEmail.length,
    created,
    updated,
    skipped,
  };
}

async function getSyncStatus(userId: string) {
  const { data: prefs } = await supabaseAdmin
    .from("connector_preferences")
    .select("preferences, updated_at")
    .eq("user_id", userId)
    .eq("connector_type", "google")
    .single();

  return {
    lastSyncAt: (prefs?.preferences as any)?.lastSyncAt ?? null,
  };
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user) => {
        if (req.method !== "POST") {
          return createErrorResponse(405, "Method Not Allowed");
        }

        const currentUserSale = await getUserSale(user);
        if (!currentUserSale) {
          return createErrorResponse(401, "Unauthorized");
        }

        try {
          const { action } = await req.json();

          let result: unknown;

          switch (action) {
            case "sync":
              result = await syncContacts(user!.id, currentUserSale.id);

              // Update last sync timestamp
              await supabaseAdmin
                .from("connector_preferences")
                .update({
                  preferences: {
                    ...(
                      await supabaseAdmin
                        .from("connector_preferences")
                        .select("preferences")
                        .eq("user_id", user!.id)
                        .eq("connector_type", "google")
                        .single()
                    ).data?.preferences as any,
                    lastSyncAt: new Date().toISOString(),
                  },
                  updated_at: new Date().toISOString(),
                })
                .eq("user_id", user!.id)
                .eq("connector_type", "google");
              break;

            case "status":
              result = await getSyncStatus(user!.id);
              break;

            default:
              return createErrorResponse(400, `Unknown action: ${action}`);
          }

          return new Response(JSON.stringify({ data: result }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        } catch (e) {
          console.error("google-contacts-sync error:", e);
          const message = e instanceof Error ? e.message : "Internal error";
          if (
            message === "GOOGLE_NOT_CONNECTED" ||
            message === "GOOGLE_TOKEN_EXPIRED"
          ) {
            return createErrorResponse(401, message);
          }
          return createErrorResponse(500, message);
        }
      }),
    ),
  ),
);
