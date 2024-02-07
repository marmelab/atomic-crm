import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import pg from "pg";

import generateData from "../src/dataGenerator/index.js";

const dataMappers = {
  tags: (tag) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
  }),
  companies: (company) => ({
    id: company.id,
    name: company.name,
    logo: company.logo,
    sector: company.sector,
    size: company.size,
    linkedIn: company.linkedIn,
    website: company.website,
    phone_number: company.phone_number,
    address: company.address,
    zipcode: company.zipcode,
    city: company.city,
    stateAbbr: company.stateAbbr,
    sales_id: company.sales_id,
    created_at: company.created_at,
  }),
  contacts: (contact) => ({
    id: contact.id,
    first_name: contact.first_name,
    last_name: contact.last_name,
    gender: contact.gender,
    title: contact.title,
    company_id: contact.company_id,
    email: contact.email,
    phone_number1: contact.phone_number1,
    phone_number2: contact.phone_number2,
    background: contact.background,
    acquisition: contact.acquisition,
    avatar: contact.avatar,
    first_seen: contact.first_seen,
    last_seen: contact.last_seen,
    has_newsletter: contact.has_newsletter,
    status: contact.status,
    tags: contact.tags,
    sales_id: contact.sales_id,
  }),
  contactNotes: (contactNote) => ({
    id: contactNote.id,
    contact_id: contactNote.contact_id,
    type: contactNote.type,
    text: contactNote.text,
    date: contactNote.date,
    sales_id: contactNote.sales_id,
    status: contactNote.status,
  }),
  deals: (deal) => ({
    id: deal.id,
    name: deal.name,
    company_id: deal.company_id,
    contact_ids: deal.contact_ids,
    type: deal.type,
    stage: deal.stage,
    description: deal.description,
    amount: deal.amount,
    created_at: deal.created_at,
    updated_at: deal.updated_at,
    start_at: deal.start_at,
    sales_id: deal.sales_id,
    index: deal.index,
  }),
  dealNotes: (dealNote) => ({
    id: dealNote.id,
    deal_id: dealNote.deal_id,
    type: dealNote.type,
    text: dealNote.text,
    date: dealNote.date,
    sales_id: dealNote.sales_id,
  }),
  tasks: (task) => ({
    id: task.id,
    contact_id: task.contact_id,
    type: task.type,
    text: task.text,
    due_date: task.due_date,
    sales_id: task.sales_id,
  }),
};

const seed = async () => {
  dotenv.config();
  if (process.env.VITE_SUPABASE_URL === undefined) {
    throw new Error("Please set the VITE_SUPABASE_URL environment variable");
  }
  if (process.env.SUPABASE_SERVICE_ROLE_KEY === undefined) {
    throw new Error(
      "Please set the SUPABASE_SERVICE_ROLE_KEY environment variable"
    );
  }
  if (process.env.DATABASE_URL === undefined) {
    throw new Error("Please set the DATABASE_URL environment variable");
  }
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const data = generateData();

  for (const sale of data.sales) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: sale.email,
      password: "Password123",
      email_confirm: true,
    });

    if (error) {
      console.error(error);
      throw new Error(`Failed to create user ${sale.email}`);
    }

    const { error: errorProfile } = await supabase.from("sales").insert({
      id: sale.id,
      first_name: sale.first_name,
      last_name: sale.last_name,
      email: sale.email,
      user_id: data.user.id,
    });

    if (errorProfile) {
      console.error(error);
      throw new Error(
        `Failed to create user ${sale.email}: ${errorProfile.message}`
      );
    }
  }

  const resources = [
    "tags",
    "companies",
    "contacts",
    "contactNotes",
    "deals",
    "dealNotes",
    "tasks",
  ];
  for (const resource of resources) {
    const { error } = await supabase
      .from(resource)
      .insert(data[resource].map(dataMappers[resource]));

    if (error) {
      console.error(error);
      throw new Error(`Failed to insert ${resource}: ${error.message}`);
    }
  }

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();
  await client.query(
    `SELECT setval('"sales_id_seq\"', COALESCE((SELECT MAX(id)+1 FROM \"sales\"), 1), false);`
  );
  await client.query(
    `SELECT setval('"tags_id_seq\"', COALESCE((SELECT MAX(id)+1 FROM \"tags\"), 1), false);`
  );
  await client.query(
    `SELECT setval('"companies_id_seq\"', COALESCE((SELECT MAX(id)+1 FROM \"companies\"), 1), false);`
  );
  await client.query(
    `SELECT setval('"contacts_id_seq\"', COALESCE((SELECT MAX(id)+1 FROM \"contacts\"), 1), false);`
  );
  await client.query(
    `SELECT setval('"contactNotes_id_seq\"', COALESCE((SELECT MAX(id)+1 FROM \"contactNotes\"), 1), false);`
  );
  await client.query(
    `SELECT setval('"deals_id_seq\"', COALESCE((SELECT MAX(id)+1 FROM \"deals\"), 1), false);`
  );
  await client.query(
    `SELECT setval('"dealNotes_id_seq\"', COALESCE((SELECT MAX(id)+1 FROM \"dealNotes\"), 1), false);`
  );
  await client.query(
    `SELECT setval('"tasks_id_seq\"', COALESCE((SELECT MAX(id)+1 FROM \"tasks\"), 1), false);`
  );
  await client.end();
};

seed()
  .then(() => {
    console.log("Populated database successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
