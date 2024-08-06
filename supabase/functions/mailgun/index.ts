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

    const data = await req.formData();
    const to = data.get('To');
    if (!to) return new Response('Missing parameter: To', { status: 406 });
    const from = data.get('from');
    if (!from) return new Response('Missing parameter: from', { status: 406 });
    const subject = data.get('subject');
    if (!subject)
        return new Response('Missing parameter: subject', { status: 406 });
    const strippedText = data.get('stripped-text');
    if (!strippedText)
        return new Response('Missing parameter: stripped-text', {
            status: 406,
        });

    const noteContent = getNoteContent(
        subject.toString(),
        strippedText.toString()
    );

    const { email: salesEmail } = extractMailContactData(from.toString());
    if (!salesEmail)
        return new Response(
            `Could not extract sales email from From: ${from}`,
            { status: 406 }
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
            { status: 406 }
        );

    const { firstName, lastName, email, domain } = extractMailContactData(
        to.toString()
    );
    if (!email)
        return new Response(`Could not extract email from To: ${to}`, {
            status: 406,
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

    // Add note to new contact
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
 * Extracts the first name, last name, email, and domain from a mail contact (e.g. "To" or "From").
 *
 * Example:
 *   From: "Alice Cooper <alice@sandbox.mailgun.org>"
 *
 * Return Value:
 *  {
 *    firstName: "Alice",
 *    lastName: "Cooper",
 *    email: "alice@sandbox.mailgun.org",
 *    domain: "sandbox.mailgun.org"
 * }
 *
 * @param to
 * @returns
 */
const extractMailContactData = (to: string) => {
    const [_match, fullName, email, domain] =
        /([^<>]+)\s<([^\s<>]+@([^\s<>]+))>/.exec(to) || [];
    let firstName = '';
    let lastName = fullName;
    if (fullName && fullName.includes(' ')) {
        const parts = fullName.split(' ');
        firstName = parts[0];
        lastName = parts.slice(1).join(' ');
    }
    return { firstName, lastName, email, domain };
};

const getNoteContent = (subject: string, strippedText: string) => `${subject}

${strippedText}`;
