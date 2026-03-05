// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { addNoteToContact } from "./addNoteToContact.ts";
import {
  getForwardedMailContent,
  stripSubjectForwardingPrefix,
} from "./forwardedParser.ts";
import { extractMailContactData } from "./extractMailContactData.ts";
import { getExpectedAuthorization } from "./getExpectedAuthorization.ts";
import { getNoteContent } from "./getNoteContent.ts";
import { extractAndUploadAttachments } from "./extractAndUploadAttachments.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const webhookUser = Deno.env.get("POSTMARK_WEBHOOK_USER");
const webhookPassword = Deno.env.get("POSTMARK_WEBHOOK_PASSWORD");
const INBOUND_EMAIL = Deno.env.get("POSTMARK_INBOUND_EMAIL");
if (!webhookUser || !webhookPassword) {
  throw new Error(
    "Missing POSTMARK_WEBHOOK_USER or POSTMARK_WEBHOOK_PASSWORD env variable",
  );
}

const rawAuthorizedIPs = Deno.env.get("POSTMARK_WEBHOOK_AUTHORIZED_IPS");
if (!rawAuthorizedIPs) {
  throw new Error("Missing POSTMARK_WEBHOOK_AUTHORIZED_IPS env variable");
}

Deno.serve(async (req) => {
  let response: Response | undefined;

  response = checkRequestTypeAndHeaders(req);
  if (response) return response;

  const json = await req.json();
  response = checkBody(json);
  if (response) return response;

  const { FromFull, Attachments } = json;
  let { ToFull, TextBody, Subject } = json;

  const { Email: salesEmail } = FromFull;
  if (!salesEmail) {
    // Return a 403 to let Postmark know that it's no use to retry this request
    // https://postmarkapp.com/developer/webhooks/inbound-webhook#errors-and-retries
    return new Response(
      `Could not extract sales email from FromFull: ${FromFull}`,
      { status: 403 },
    );
  }

  const allSales = await supabaseAdmin.from("sales").select("email");
  const salesEmails =
    allSales.data?.map((s: { email: string }) => s.email) ?? [];

  // If we have an INBOUND_EMAIL and the email is sent to the inbound email address, and the sender is a known sales email,
  // then we can try to extract the real recipient email from the body of the email
  if (
    INBOUND_EMAIL &&
    ToFull.length === 1 &&
    ToFull[0].Email === INBOUND_EMAIL &&
    salesEmails.includes(FromFull.Email)
  ) {
    const emailRegex = /[\w.+%-]+@[\w.-]+\.[a-zA-Z]{2,}/g;
    const emailsInBody = TextBody.match(emailRegex) || [];

    const candidateEmails = emailsInBody.filter(
      (email: string) =>
        email !== INBOUND_EMAIL && !salesEmails?.includes(email),
    );
    if (candidateEmails.length > 0) {
      ToFull = [
        {
          Email: candidateEmails[0],
          Name: "",
        },
      ];
    } else {
      // Return a 403 to let Postmark know that it's no use to retry this request
      // https://postmarkapp.com/developer/webhooks/inbound-webhook#errors-and-retries
      return new Response(
        `Could not extract recipient email from transferred email body.`,
        { status: 403 },
      );
    }
    TextBody = getForwardedMailContent(TextBody);
    Subject = stripSubjectForwardingPrefix(Subject);
  }

  const noteContent = getNoteContent(Subject, TextBody);

  const contacts = extractMailContactData(ToFull);

  const attachments = await extractAndUploadAttachments(Attachments);

  for (const { firstName, lastName, email, domain } of contacts) {
    if (!email) {
      // Return a 403 to let Postmark know that it's no use to retry this request
      // https://postmarkapp.com/developer/webhooks/inbound-webhook#errors-and-retries
      return new Response(`Could not extract email from ToFull: ${ToFull}`, {
        status: 403,
      });
    }

    await addNoteToContact({
      salesEmail,
      email,
      domain,
      firstName,
      lastName,
      noteContent,
      attachments,
    });
  }

  return new Response("OK");
});

const checkRequestTypeAndHeaders = (req: Request) => {
  // Only allow known IP addresses
  // We can use the x-forwarded-for header as it is populated by Supabase
  // https://supabase.com/docs/guides/api/securing-your-api#accessing-request-information
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (!forwardedFor) {
    return new Response("Unauthorized", { status: 401 });
  }
  const ips = forwardedFor.split(",").map((ip) => ip.trim());
  const authorizedIPs = rawAuthorizedIPs
    .split(",")
    .map((ip: string) => ip.trim());
  if (!ips.some((ip) => authorizedIPs.includes(ip))) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  // Check the Authorization header
  const expectedAuthorization = getExpectedAuthorization(
    webhookUser,
    webhookPassword,
  );
  const authorization = req.headers.get("Authorization");
  if (authorization !== expectedAuthorization) {
    return new Response("Unauthorized", { status: 401 });
  }
};

// deno-lint-ignore no-explicit-any
const checkBody = (json: any) => {
  const { ToFull, FromFull, Subject, TextBody } = json;

  // In case of incorrect request data, we
  // return a 403 to let Postmark know that it's no use to retry this request
  // https://postmarkapp.com/developer/webhooks/inbound-webhook#errors-and-retries
  if (!ToFull || !ToFull.length)
    return new Response("Missing parameter: ToFull", { status: 403 });
  if (!FromFull)
    return new Response("Missing parameter: FromFull", { status: 403 });
  if (!Subject)
    return new Response("Missing parameter: Subject", { status: 403 });
  if (!TextBody)
    return new Response("Missing parameter: TextBody", {
      status: 403,
    });
};

/* To invoke locally:
  1. Run `make start`
  2. Make sure to have a Sales with email "support@postmarkapp.com" (create it if needed)
  3. OPTIONAL: Create a Contact with email "firstname.lastname@marmelab.com"
  4. In another terminal, run `make start-supabase-functions`
  5. In another terminal, make an HTTP request:
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/postmark' \
    --header 'Content-Type: application/json' \
    --header 'Authorization: Basic dGVzdHVzZXI6dGVzdHB3ZA==' \
    --data '{
        "FromName": "Postmarkapp Support",
        "From": "support@postmarkapp.com",
        "FromFull": {
            "Email": "support@postmarkapp.com",
            "Name": "Postmarkapp Support",
            "MailboxHash": ""
        },
        "To": "\"Firstname Lastname\" <firstname.lastname@marmelab.com>",
        "ToFull": [
            {
            "Email": "firstname.lastname@marmelab.com",
            "Name": "Firstname Lastname",
            "MailboxHash": "SampleHash"
            }
        ],
        "Cc": "\"First Cc\" <firstcc@postmarkapp.com>, secondCc@postmarkapp.com",
        "CcFull": [
            {
            "Email": "firstcc@postmarkapp.com",
            "Name": "First Cc",
            "MailboxHash": ""
            },
            {
            "Email": "secondCc@postmarkapp.com",
            "Name": "",
            "MailboxHash": ""
            }
        ],
        "Bcc": "\"First Bcc\" <firstbcc@postmarkapp.com>, secondbcc@postmarkapp.com",
        "BccFull": [
            {
            "Email": "firstbcc@postmarkapp.com",
            "Name": "First Bcc",
            "MailboxHash": ""
            },
            {
            "Email": "secondbcc@postmarkapp.com",
            "Name": "",
            "MailboxHash": ""
            }
        ],
        "OriginalRecipient": "firstname.lastname@marmelab.com",
        "Subject": "Test subject",
        "MessageID": "73e6d360-66eb-11e1-8e72-a8904824019b",
        "ReplyTo": "replyto@postmarkapp.com",
        "MailboxHash": "SampleHash",
        "Date": "Fri, 1 Aug 2014 16:45:32 -04:00",
        "TextBody": "This is a test text body.",
        "HtmlBody": "<html><body><p>This is a test html body.</p></body></html>",
        "StrippedTextReply": "This is the reply text",
        "Tag": "TestTag",
        "Headers": [
            {
            "Name": "X-Header-Test",
            "Value": ""
            },
            {
            "Name": "X-Spam-Status",
            "Value": "No"
            },
            {
            "Name": "X-Spam-Score",
            "Value": "-0.1"
            },
            {
            "Name": "X-Spam-Tests",
            "Value": "DKIM_SIGNED,DKIM_VALID,DKIM_VALID_AU,SPF_PASS"
            }
        ],
        "Attachments": [
            {
            "Name": "test.txt",
            "Content": "VGhpcyBpcyBhdHRhY2htZW50IGNvbnRlbnRzLCBiYXNlLTY0IGVuY29kZWQu",
            "ContentType": "text/plain",
            "ContentLength": 45
            }
        ]
      }'
  To trigger the email forwarding feature, you can change the "To" and "ToFull" fields to have the INBOUND_EMAIL, and add an email address that is neither a sales nor the INBOUND_EMAIL, for example:
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/postmark' \
    --header 'Content-Type: application/json' \
    --header 'Authorization: Basic dGVzdHVzZXI6dGVzdHB3ZA==' \
    --data '{
      "FromName": "Postmarkapp Support",
      "MessageStream": "inbound",
      "From": "support@postmarkapp.com",
      "FromFull": {
        "Email": "support@postmarkapp.com",
        "Name": "Postmarkapp Support",
        "MailboxHash": ""
      },
      "To": "2aff30e603e54dc3eb556bd9e03ee099@inbound.postmarkapp.com",
      "ToFull": [
        {
          "Email": "2aff30e603e54dc3eb556bd9e03ee099@inbound.postmarkapp.com",
          "Name": "",
          "MailboxHash": ""
        }
      ],
      "Cc": "",
      "CcFull": [],
      "Bcc": "",
      "BccFull": [],
      "OriginalRecipient": "2aff30e603e54dc3eb556bd9e03ee099@inbound.postmarkapp.com",
      "Subject": "Fwd: Test for forwarding mail",
      "MessageID": "32dcbecb-57d0-476e-9591-c747808cb599",
      "ReplyTo": "",
      "MailboxHash": "",
      "Date": "Thu, 5 Mar 2026 10:41:26 +0100",
      "TextBody": "---------- Forwarded message ---------\nFrom : Postmarkapp Support <original.recipient@company.com>\nDate: Fri, 1 Aug 2014 16:45:32 -04:00\nSubject: Test for forwarding mail\nTo: Postmarkapp Support <support@postmarkapp.com>\n\n\nThe transferred message body\n",
      "HtmlBody": "<div dir=\"ltr\"><br><br><div class=\"gmail_quote gmail_quote_container\"><div dir=\"ltr\" class=\"gmail_attr\">---------- Forwarded message ---------<br>From: <strong class=\"gmail_sendername\" dir=\"auto\">Postmarkapp Support</strong> <span dir=\"auto\">&lt;<a href=\"mailto:original.recipient@company.com\">original.recipient@company.com</a>&gt;</span><br>Date: Fri, 1 Aug 2014 16:45:32 -04:00<br>Subject: Test for forwarding mail<br>To: Postmarkapp Support &lt;<a href=\"mailto:support@postmarkapp.com\">support@postmarkapp.com</a>&gt;<br></div><br><br><div dir=\"ltr\">The transferred message body</div>\n</div></div>\n",
      "StrippedTextReply": "",
      "Tag": "",
      "Headers": [
            {
                "Name": "X-Header-Test",
                "Value": ""
            },
            {
                "Name": "X-Spam-Status",
                "Value": "No"
            },
            {
                "Name": "X-Spam-Score",
                "Value": "-0.1"
            },
            {
                "Name": "X-Spam-Tests",
                "Value": "DKIM_SIGNED,DKIM_VALID,DKIM_VALID_AU,SPF_PASS"
            }
      ],
      "Attachments": []
    }'

*/
