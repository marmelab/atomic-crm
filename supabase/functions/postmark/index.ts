// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';

Deno.serve(async req => {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return new Response(null, { status: 405 });
    }

    const { ToFull, FromFull, Subject, StrippedTextReply } = await req.json();

    if (!ToFull || !ToFull.length)
        return new Response('Missing parameter: ToFull', { status: 403 });
    if (!FromFull)
        return new Response('Missing parameter: FromFull', { status: 403 });
    if (!Subject)
        return new Response('Missing parameter: Subject', { status: 403 });
    if (!StrippedTextReply)
        return new Response('Missing parameter: StrippedTextReply', {
            status: 403,
        });

    const noteContent = getNoteContent(Subject, StrippedTextReply);

    const { Email: salesEmail } = FromFull;
    if (!salesEmail)
        return new Response(
            `Could not extract sales email from FromFull: ${FromFull}`,
            { status: 403 }
        );
    const { data: sales, error: fetchSalesError } = await supabaseAdmin
        .from('sales')
        .select('*')
        .eq('email', salesEmail)
        .maybeSingle();
    if (fetchSalesError)
        return new Response(
            `Could not fetch sales from database, email: ${salesEmail}`,
            { status: 500 }
        );
    if (!sales)
        return new Response(
            `Unable to find sales in database, email: ${salesEmail}`,
            { status: 403 }
        );

    const { firstName, lastName, email, domain } =
        extractMailContactData(ToFull);
    if (!email)
        return new Response(`Could not extract email from ToFull: ${ToFull}`, {
            status: 403,
        });

    const { data: existingContact, error: fetchContactError } =
        await supabaseAdmin
            .from('contacts')
            .select('*')
            .eq('email', email)
            .maybeSingle();
    if (fetchContactError)
        return new Response(
            `Could not fetch contact from database, email: ${email}`,
            { status: 500 }
        );

    // deno-lint-ignore no-explicit-any
    let contact: any = undefined;
    if (existingContact) {
        contact = existingContact;
    } else {
        // If the contact does not exist, we need to create it, along with the company if needed
        const { data: existingCompany, error: fetchCompanyError } =
            await supabaseAdmin
                .from('companies')
                .select('*')
                .eq('name', domain)
                .maybeSingle();
        if (fetchCompanyError)
            return new Response(
                `Could not fetch companies from database, name: ${domain}`,
                { status: 500 }
            );

        // deno-lint-ignore no-explicit-any
        let company: any = undefined;
        if (existingCompany) {
            company = existingCompany;
        } else {
            const { data: newCompanies, error: createCompanyError } =
                await supabaseAdmin
                    .from('companies')
                    .insert({ name: domain, sales_id: sales.id })
                    .select();
            if (createCompanyError)
                return new Response(
                    `Could not create company in database, name: ${domain}`,
                    { status: 500 }
                );
            company = newCompanies[0];
        }

        // Create the contact
        const { data: newContacts, error: createContactError } =
            await supabaseAdmin
                .from('contacts')
                .insert({
                    first_name: firstName,
                    last_name: lastName,
                    email,
                    company_id: company.id,
                    sales_id: sales.id,
                    first_seen: new Date(),
                    last_seen: new Date(),
                    tags: [],
                })
                .select();
        if (createContactError || !newContacts[0])
            return new Response(
                `Could not create contact in database, email: ${email}`,
                { status: 500 }
            );
        contact = newContacts[0];
    }

    // Add note to contact
    const { error: createNoteError } = await supabaseAdmin
        .from('contactNotes')
        .insert({
            contact_id: contact.id,
            text: noteContent,
            sales_id: sales.id,
        });
    if (createNoteError)
        return new Response(
            `Could not add note to contact ${email}, sales ${salesEmail}`,
            { status: 500 }
        );

    return new Response('OK');
});

/**
 * Extracts the first name, last name, email, and domain from a mail contact.
 *
 * Example:
 *   "ToFull": [
 *     {
 *       "Email": "firstname.lastname@marmelab.com",
 *       "Name": "Firstname Lastname"
 *     }
 *   ]
 *
 * Return Value:
 *  {
 *    firstName: "Firstname",
 *    lastName: "Lastname",
 *    email: "firstname.lastname@marmelab.com",
 *    domain: "marmelab.com.com"
 * }
 *
 */
const extractMailContactData = (
    ToFull: {
        Email: string;
        Name: string;
    }[]
) => {
    // We only support one recipient for now
    const contact = ToFull[0];

    const domain = contact.Email.split('@')[1];
    const fullName = contact.Name;
    let firstName = '';
    let lastName = fullName;
    if (fullName && fullName.includes(' ')) {
        const parts = fullName.split(' ');
        firstName = parts[0];
        lastName = parts.slice(1).join(' ');
    }
    return { firstName, lastName, email: contact.Email, domain };
};

const getNoteContent = (subject: string, strippedText: string) => `${subject}

${strippedText}`;

/* To invoke locally:
  1. Run `make start`
  2. Make sure to have a Sales with email "support@postmarkapp.com" (create it if needed)
  3. OPTIONAL: Create a Contact with email "firstname.lastname@marmelab.com"
  4. In another terminal, run `make start-supabase-functions`
  5. In another terminal, make an HTTP request:
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/postmark' \
    --header 'Content-Type: application/json' \
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
*/
