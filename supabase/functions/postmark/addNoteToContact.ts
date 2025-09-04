import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

export const addNoteToContact = async ({
  salesEmail,
  email,
  domain,
  firstName,
  lastName,
  noteContent,
}: {
  salesEmail: string;
  email: string;
  domain: string;
  firstName: string;
  lastName: string;
  noteContent: string;
}) => {
  const { data: sales, error: fetchSalesError } = await supabaseAdmin
    .from("sales")
    .select("*")
    .eq("email", salesEmail)
    .neq("disabled", true)
    .maybeSingle();
  if (fetchSalesError)
    return new Response(
      `Could not fetch sales from database, email: ${salesEmail}`,
      { status: 500 },
    );
  if (!sales) {
    // Return a 403 to let Postmark know that it's no use to retry this request
    // https://postmarkapp.com/developer/webhooks/inbound-webhook#errors-and-retries
    return new Response(
      `Unable to find (active) sales in database, email: ${salesEmail}`,
      { status: 403 },
    );
  }

  // Check if the contact already exists
  const { data: existingContact, error: fetchContactError } =
    await supabaseAdmin
      .from("contacts")
      .select("*")
      .contains("email_jsonb", JSON.stringify([{ email }]))
      .maybeSingle();
  if (fetchContactError)
    return new Response(
      `Could not fetch contact from database, email: ${email}`,
      { status: 500 },
    );

  // deno-lint-ignore no-explicit-any
  let contact: any = undefined;
  if (existingContact) {
    contact = existingContact;
  } else {
    // If the contact does not exist, we need to create it, along with the company if needed

    // Check if the company already exists
    const { data: existingCompany, error: fetchCompanyError } =
      await supabaseAdmin
        .from("companies")
        .select("*")
        .eq("name", domain)
        .maybeSingle();
    if (fetchCompanyError)
      return new Response(
        `Could not fetch companies from database, name: ${domain}`,
        { status: 500 },
      );

    // deno-lint-ignore no-explicit-any
    let company: any = undefined;
    if (existingCompany) {
      company = existingCompany;
    } else {
      const { data: newCompanies, error: createCompanyError } =
        await supabaseAdmin
          .from("companies")
          .insert({ name: domain, sales_id: sales.id })
          .select();
      if (createCompanyError)
        return new Response(
          `Could not create company in database, name: ${domain}`,
          { status: 500 },
        );
      company = newCompanies[0];
    }

    // Create the contact
    const { data: newContacts, error: createContactError } = await supabaseAdmin
      .from("contacts")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email_jsonb: [{ email, type: "Work" }],
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
        { status: 500 },
      );
    contact = newContacts[0];
  }

  // Add note to contact
  const { error: createNoteError } = await supabaseAdmin
    .from("contactNotes")
    .insert({
      contact_id: contact.id,
      text: noteContent,
      sales_id: sales.id,
    });
  if (createNoteError)
    return new Response(
      `Could not add note to contact ${email}, sales ${salesEmail}`,
      { status: 500 },
    );

  await supabaseAdmin
    .from("contacts")
    .update({ last_seen: new Date() })
    .eq("id", contact.id);
};
