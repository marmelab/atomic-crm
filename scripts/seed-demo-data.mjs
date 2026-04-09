/**
 * seed-demo-data.mjs
 *
 * Populates a live Supabase instance with realistic construction-industry
 * demo data. Requires a .env.seed file with SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY.
 *
 * Usage: node scripts/seed-demo-data.mjs [--clean]
 *   --clean  Wipe all existing data before seeding (default: true)
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// 1. Load env
// ---------------------------------------------------------------------------
const envPath = path.resolve(process.cwd(), ".env.seed");
if (!fs.existsSync(envPath)) {
  console.error("Missing .env.seed — create it with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const env = Object.fromEntries(
  fs.readFileSync(envPath, "utf-8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => l.split("=").map((s) => s.trim()))
    .map(([k, ...v]) => [k, v.join("=")])
);

const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.seed");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// 2. Helpers
// ---------------------------------------------------------------------------
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pickN = (arr, n) => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
};
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const daysAgo = (n) => new Date(Date.now() - n * 86400000);
const daysFromNow = (n) => new Date(Date.now() + n * 86400000);
const isoDate = (d) => d.toISOString().split("T")[0];
const isoTimestamp = (d) => d.toISOString();
const randomDateBetween = (start, end) =>
  new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

// ---------------------------------------------------------------------------
// 3. Seed data — realistic construction vertical
// ---------------------------------------------------------------------------
const COMPANIES = [
  { name: "Summit Roofing Co.", sector: "roofing", trade: "Roofing", size: "6-20", tech: "Paper", area: "Greater Toronto Area", phone: "(416) 555-0101" },
  { name: "Northwind HVAC Services", sector: "hvac", trade: "HVAC", size: "21-50", tech: "Basic Digital", area: "Toronto & Mississauga", phone: "(416) 555-0202" },
  { name: "Clearwater Plumbing", sector: "plumbing", trade: "Plumbing", size: "6-20", tech: "Paper", area: "Scarborough & Pickering", phone: "(416) 555-0303" },
  { name: "Volt Electric Ltd.", sector: "electrical", trade: "Electrical", size: "1-5", tech: "Paper", area: "North York", phone: "(647) 555-0404" },
  { name: "Ironclad General Contracting", sector: "general-contractor", trade: "General Contractor", size: "50+", tech: "Basic Digital", area: "GTA & Hamilton", phone: "(905) 555-0505" },
  { name: "GreenEdge Landscaping", sector: "landscaping", trade: "Landscaping", size: "6-20", tech: "Automated", area: "Vaughan & Richmond Hill", phone: "(905) 555-0606" },
  { name: "ProCoat Painting Inc.", sector: "painting", trade: "Painting", size: "1-5", tech: "Paper", area: "Etobicoke", phone: "(416) 555-0707" },
  { name: "Lakeshore Flooring", sector: "flooring", trade: "Flooring", size: "6-20", tech: "Basic Digital", area: "Oakville & Burlington", phone: "(905) 555-0808" },
  { name: "TrueFrame Windows & Doors", sector: "windows-doors", trade: "Windows & Doors", size: "21-50", tech: "Basic Digital", area: "Brampton & Caledon", phone: "(905) 555-0909" },
  { name: "Bedrock Foundations", sector: "general-contractor", trade: "General Contractor", size: "6-20", tech: "Paper", area: "Durham Region", phone: "(905) 555-1010" },
];

const CONTACTS = [
  { first: "Marco", last: "Rossi", title: "Owner", gender: "male", company: 0, status: "hot", email: "marco@summitroofing.ca" },
  { first: "Sarah", last: "Chen", title: "Operations Manager", gender: "female", company: 1, status: "warm", email: "sarah.chen@northwindhvac.ca" },
  { first: "Dave", last: "Thompson", title: "Owner", gender: "male", company: 2, status: "cold", email: "dave@clearwaterplumbing.ca" },
  { first: "Raj", last: "Patel", title: "Owner/Operator", gender: "male", company: 3, status: "hot", email: "raj@voltelectric.ca" },
  { first: "Lisa", last: "Moreau", title: "VP Operations", gender: "female", company: 4, status: "warm", email: "lisa.moreau@ironcladgc.ca" },
  { first: "Mike", last: "O'Brien", title: "Project Manager", gender: "male", company: 4, status: "cold", email: "mike.obrien@ironcladgc.ca" },
  { first: "Tanya", last: "Ivanova", title: "Owner", gender: "female", company: 5, status: "hot", email: "tanya@greenedge.ca" },
  { first: "James", last: "Wilson", title: "Owner", gender: "male", company: 6, status: "warm", email: "james@procoat.ca" },
  { first: "Priya", last: "Sharma", title: "Sales Manager", gender: "female", company: 7, status: "cold", email: "priya@lakeshoreflooring.ca" },
  { first: "Tom", last: "Baker", title: "Owner", gender: "male", company: 7, status: "warm", email: "tom@lakeshoreflooring.ca" },
  { first: "Natasha", last: "Petrov", title: "General Manager", gender: "female", company: 8, status: "hot", email: "natasha@trueframe.ca" },
  { first: "Carlos", last: "Rivera", title: "Owner", gender: "male", company: 9, status: "cold", email: "carlos@bedrockfoundations.ca" },
  { first: "Emily", last: "Fong", title: "Office Manager", gender: "female", company: 1, status: "cold", email: "emily.fong@northwindhvac.ca" },
  { first: "Hassan", last: "Ali", title: "Estimator", gender: "male", company: 4, status: "warm", email: "hassan.ali@ironcladgc.ca" },
  { first: "Sandra", last: "Kowalski", title: "Bookkeeper", gender: "female", company: 8, status: "warm", email: "sandra@trueframe.ca" },
];

const DEALS = [
  // Active pipeline — spread across stages
  { name: "Summit Roofing AI Audit", company: 0, contacts: [0], stage: "lead", category: "ai-audit", amount: 2500, daysOld: 3 },
  { name: "Northwind Workflow Automation", company: 1, contacts: [1, 12], stage: "qualified", category: "workflow-automation", amount: 8500, daysOld: 12 },
  { name: "Clearwater CRM Setup", company: 2, contacts: [2], stage: "lead", category: "crm-setup", amount: 3000, daysOld: 7 },
  { name: "Volt Electric Full Package", company: 3, contacts: [3], stage: "audit-scheduled", category: "full-package", amount: 12000, daysOld: 18 },
  { name: "Ironclad Estimating Automation", company: 4, contacts: [4, 5, 13], stage: "proposal-sent", category: "workflow-automation", amount: 15000, daysOld: 25 },
  { name: "GreenEdge Scheduling System", company: 5, contacts: [6], stage: "audit-scheduled", category: "workflow-automation", amount: 6000, daysOld: 10 },
  { name: "ProCoat Job Costing Audit", company: 6, contacts: [7], stage: "qualified", category: "ai-audit", amount: 2500, daysOld: 5 },
  { name: "Lakeshore CRM + Quoting", company: 7, contacts: [8, 9], stage: "proposal-sent", category: "full-package", amount: 11000, daysOld: 30 },
  { name: "TrueFrame Lead Capture", company: 8, contacts: [10, 14], stage: "lead", category: "crm-setup", amount: 4500, daysOld: 2 },
  { name: "Bedrock Foundations Audit", company: 9, contacts: [11], stage: "qualified", category: "ai-audit", amount: 2500, daysOld: 8 },
  // Won deals
  { name: "Northwind Invoice Automation", company: 1, contacts: [1], stage: "won", category: "workflow-automation", amount: 7500, daysOld: 60 },
  { name: "Ironclad Timesheet System", company: 4, contacts: [4], stage: "won", category: "workflow-automation", amount: 9000, daysOld: 45 },
  { name: "GreenEdge AI Audit", company: 5, contacts: [6], stage: "won", category: "ai-audit", amount: 2500, daysOld: 35 },
  // Lost deals
  { name: "Clearwater Full Package", company: 2, contacts: [2], stage: "lost", category: "full-package", amount: 10000, daysOld: 40 },
  { name: "ProCoat CRM Setup", company: 6, contacts: [7], stage: "lost", category: "crm-setup", amount: 3500, daysOld: 50 },
];

const TAGS = [
  { name: "Decision Maker", color: "#4DC8E8" },
  { name: "Referral Source", color: "#E8CB7D" },
  { name: "Early Adopter", color: "#A4E87D" },
  { name: "High Value", color: "#E88B7D" },
  { name: "Needs Follow-up", color: "#C49AE8" },
  { name: "Conference Lead", color: "#E8A47D" },
];

// Contact → tag assignments (contact index → tag indices)
const CONTACT_TAGS = {
  0: [0, 3],       // Marco: Decision Maker, High Value
  1: [0, 2],       // Sarah: Decision Maker, Early Adopter
  3: [0, 2, 3],    // Raj: Decision Maker, Early Adopter, High Value
  4: [0],          // Lisa: Decision Maker
  6: [0, 2, 1],    // Tanya: Decision Maker, Early Adopter, Referral Source
  7: [0],          // James: Decision Maker
  9: [0, 3],       // Tom: Decision Maker, High Value
  10: [0, 5],      // Natasha: Decision Maker, Conference Lead
  11: [0, 4],      // Carlos: Decision Maker, Needs Follow-up
};

const TASK_TEMPLATES = [
  // Overdue (past due, not done)
  { text: "Follow up on audit scheduling with Marco", contact: 0, type: "follow-up", dueDaysAgo: 3, done: false },
  { text: "Send Northwind proposal revision", contact: 1, type: "email", dueDaysAgo: 1, done: false },
  { text: "Call Dave about CRM demo", contact: 2, type: "call", dueDaysAgo: 5, done: false },
  { text: "Review Ironclad estimating requirements", contact: 4, type: "meeting", dueDaysAgo: 2, done: false },
  // Due today/upcoming (not done)
  { text: "Demo call with Raj — full package walkthrough", contact: 3, type: "demo", dueDaysFromNow: 0, done: false },
  { text: "Send GreenEdge scheduling proposal", contact: 6, type: "proposal", dueDaysFromNow: 1, done: false },
  { text: "Site visit at ProCoat shop", contact: 7, type: "site-visit", dueDaysFromNow: 3, done: false },
  { text: "Check in with Lakeshore on proposal", contact: 8, type: "follow-up", dueDaysFromNow: 2, done: false },
  { text: "Prep TrueFrame audit call", contact: 10, type: "audit-call", dueDaysFromNow: 5, done: false },
  { text: "Discovery call with Bedrock", contact: 11, type: "call", dueDaysFromNow: 4, done: false },
  { text: "Email Sandra re: onboarding timeline", contact: 14, type: "email", dueDaysFromNow: 1, done: false },
  { text: "Follow up with Hassan on scope doc", contact: 13, type: "follow-up", dueDaysFromNow: 6, done: false },
  // Completed tasks
  { text: "Initial call with Northwind team", contact: 1, type: "call", dueDaysAgo: 15, done: true, doneDaysAgo: 14 },
  { text: "Sent intro email to GreenEdge", contact: 6, type: "email", dueDaysAgo: 20, done: true, doneDaysAgo: 20 },
  { text: "Audit call with Ironclad", contact: 4, type: "audit-call", dueDaysAgo: 30, done: true, doneDaysAgo: 29 },
  { text: "Demo for Lakeshore team", contact: 9, type: "demo", dueDaysAgo: 25, done: true, doneDaysAgo: 24 },
  { text: "Sent Northwind invoice automation contract", contact: 1, type: "email", dueDaysAgo: 55, done: true, doneDaysAgo: 55 },
  { text: "Site visit at Ironclad HQ", contact: 5, type: "site-visit", dueDaysAgo: 35, done: true, doneDaysAgo: 34 },
  { text: "Follow up with Carlos re: audit", contact: 11, type: "follow-up", dueDaysAgo: 10, done: true, doneDaysAgo: 9 },
  { text: "Meeting with Emily about Northwind onboarding", contact: 12, type: "meeting", dueDaysAgo: 50, done: true, doneDaysAgo: 49 },
];

const CONTACT_NOTES = [
  { contact: 0, text: "Very interested in AI audit. Runs a crew of 12, handles estimating himself. Pain point: spending 3h/day on quotes.", status: "hot", daysAgo: 3 },
  { contact: 1, text: "Sarah manages ops for 30+ technicians. Currently using spreadsheets for scheduling. Open to automation.", status: "warm", daysAgo: 12 },
  { contact: 2, text: "Called Dave. Skeptical about tech — had a bad experience with a CRM vendor last year. Needs trust-building.", status: "cold", daysAgo: 7 },
  { contact: 3, text: "Raj is tech-savvy for a trades owner. Already uses Google Workspace. Wants the full package — audit, CRM, automations.", status: "hot", daysAgo: 18 },
  { contact: 4, text: "Lisa sees the value but needs buy-in from the partners. Sent a case study deck. Following up next week.", status: "warm", daysAgo: 20 },
  { contact: 6, text: "Tanya runs a tight operation. Already uses some automations (Zapier). Interested in a purpose-built CRM for her team.", status: "hot", daysAgo: 10 },
  { contact: 7, text: "James is interested but price-sensitive. Small operation — just him and 2 painters. Audit is the right entry point.", status: "warm", daysAgo: 5 },
  { contact: 8, text: "Priya manages sales for Lakeshore. They do 200+ quotes/month manually. Huge automation potential.", status: "cold", daysAgo: 28 },
  { contact: 10, text: "Met Natasha at the OHBA trade show. Sharp, decisive. Wants a demo next week.", status: "hot", daysAgo: 2 },
  { contact: 11, text: "Carlos is old-school — paper everything. But his son (not in contacts yet) is pushing him to modernize.", status: "cold", daysAgo: 8 },
  { contact: 1, text: "Northwind signed invoice automation contract. Onboarding starts next week. Sarah is the primary contact.", status: "warm", daysAgo: 55 },
  { contact: 4, text: "Ironclad signed timesheet system. Implementation went smoothly. Now exploring estimating automation as phase 2.", status: "warm", daysAgo: 40 },
];

const DEAL_NOTES = [
  { deal: 0, text: "Marco wants to see how the audit handles complex roof assemblies. Need to prep examples.", type: "Note", daysAgo: 2 },
  { deal: 1, text: "Northwind team wants to automate dispatch + invoicing. Two-phase approach proposed.", type: "Note", daysAgo: 10 },
  { deal: 4, text: "Ironclad proposal sent. $15K for estimating automation. Lisa reviewing with partners this week.", type: "Note", daysAgo: 5 },
  { deal: 7, text: "Lakeshore wants quoting + CRM bundled. Priya is the champion, Tom signs off.", type: "Note", daysAgo: 8 },
  { deal: 10, text: "Invoice automation live. Northwind saving ~10h/week. Great reference case.", type: "Note", daysAgo: 30 },
  { deal: 13, text: "Dave went with a competitor. Price was the deciding factor. Keep relationship warm for future.", type: "Note", daysAgo: 38 },
];

// ---------------------------------------------------------------------------
// 4. Clean existing data (reverse FK order)
// ---------------------------------------------------------------------------
async function cleanAll() {
  console.log("Cleaning existing data...");

  // Delete in reverse FK order
  // Tables with standard `id` PK
  const idTables = [
    "deal_notes",
    "contact_notes",
    "tasks",
    "deals",
    "contacts",
    "companies",
    "tags",
    "sales",
  ];

  // Join tables without an `id` column — delete by FK
  const joinTables = [
    { table: "deal_contacts", column: "deal_id" },
    { table: "contact_tags", column: "contact_id" },
  ];

  for (const { table, column } of joinTables) {
    const { error } = await supabase.from(table).delete().gte(column, 0);
    if (error) console.warn(`  Warning cleaning ${table}: ${error.message}`);
    else console.log(`  Cleared ${table}`);
  }

  for (const table of idTables) {
    const { error } = await supabase.from(table).delete().gte("id", 0);
    if (error) console.warn(`  Warning cleaning ${table}: ${error.message}`);
    else console.log(`  Cleared ${table}`);
  }

  // Delete auth users (except any admin/system accounts you want to keep)
  const { data: users } = await supabase.auth.admin.listUsers();
  if (users?.users) {
    for (const user of users.users) {
      await supabase.auth.admin.deleteUser(user.id);
      console.log(`  Deleted auth user: ${user.email}`);
    }
  }

  console.log("Clean complete.\n");
}

// ---------------------------------------------------------------------------
// 5. Seed
// ---------------------------------------------------------------------------
async function seed() {
  console.log("Starting seed...\n");

  // -- 5a. Create auth user (trigger auto-creates sales row) --
  console.log("Creating sales user...");
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: "nathan@hatchtheory.com",
    password: "demo1234!",
    email_confirm: true,
    user_metadata: { first_name: "Nathan", last_name: "Mitchell" },
  });

  if (authError) {
    console.error("Failed to create auth user:", authError.message);
    process.exit(1);
  }

  const userId = authUser.user.id;

  // Wait briefly for the trigger to fire, then fetch the auto-created sales row
  await new Promise((r) => setTimeout(r, 1000));

  const { data: salesRows, error: salesError } = await supabase
    .from("sales")
    .select()
    .eq("user_id", userId);

  if (salesError || !salesRows?.length) {
    console.error("Failed to find auto-created sales record:", salesError?.message || "no rows");
    process.exit(1);
  }

  const salesId = salesRows[0].id;
  console.log(`  Sales user created: id=${salesId}, auth=${userId}\n`);

  // -- 5b. Tags --
  console.log("Creating tags...");
  const { data: tagRows, error: tagError } = await supabase
    .from("tags")
    .insert(TAGS.map((t) => ({ name: t.name, color: t.color })))
    .select();

  if (tagError) {
    console.error("Failed to create tags:", tagError.message);
    process.exit(1);
  }
  console.log(`  ${tagRows.length} tags created\n`);

  // -- 5c. Lookup tables (query existing, don't re-insert) --
  console.log("Fetching lookup tables...");
  const { data: tradeTypes } = await supabase.from("trade_types").select("id, name");
  const { data: leadSources } = await supabase.from("lead_sources").select("id, name");

  const tradeMap = Object.fromEntries((tradeTypes || []).map((t) => [t.name, t.id]));
  const sourceMap = Object.fromEntries((leadSources || []).map((s) => [s.name, s.id]));
  console.log(`  ${Object.keys(tradeMap).length} trade types, ${Object.keys(sourceMap).length} lead sources\n`);

  // -- 5d. Companies --
  console.log("Creating companies...");
  const companyInserts = COMPANIES.map((c) => ({
    name: c.name,
    sector: c.sector,
    sales_id: salesId,
    trade_type_id: tradeMap[c.trade] || null,
    company_size: c.size,
    tech_maturity: c.tech,
    service_area: c.area,
    phone_number: c.phone,
    created_at: isoTimestamp(daysAgo(randInt(30, 90))),
  }));

  const { data: companyRows, error: companyError } = await supabase
    .from("companies")
    .insert(companyInserts)
    .select();

  if (companyError) {
    console.error("Failed to create companies:", companyError.message);
    process.exit(1);
  }
  console.log(`  ${companyRows.length} companies created\n`);

  // -- 5e. Contacts --
  console.log("Creating contacts...");
  const leadSourceNames = ["Manual", "Referral", "Website", "Google Maps", "Cold Outreach", "Inbound"];

  const contactInserts = CONTACTS.map((c) => ({
    first_name: c.first,
    last_name: c.last,
    title: c.title,
    gender: c.gender,
    company_id: companyRows[c.company].id,
    sales_id: salesId,
    lead_source_id: sourceMap[pick(leadSourceNames)] || null,
    email_jsonb: [{ email: c.email, type: "Work" }],
    status: c.status,
    first_seen: isoTimestamp(daysAgo(randInt(10, 90))),
    last_seen: isoTimestamp(daysAgo(randInt(0, 10))),
    tags: [],  // will be populated via dual-write
  }));

  const { data: contactRows, error: contactError } = await supabase
    .from("contacts")
    .insert(contactInserts)
    .select();

  if (contactError) {
    console.error("Failed to create contacts:", contactError.message);
    process.exit(1);
  }
  console.log(`  ${contactRows.length} contacts created\n`);

  // -- 5f. Contact tags (join table + array dual-write) --
  console.log("Assigning tags...");
  const contactTagInserts = [];
  for (const [contactIdx, tagIndices] of Object.entries(CONTACT_TAGS)) {
    const contactId = contactRows[Number(contactIdx)].id;
    const tagIds = tagIndices.map((ti) => tagRows[ti].id);

    // Join table rows
    for (const tagId of tagIds) {
      contactTagInserts.push({ contact_id: contactId, tag_id: tagId });
    }

    // Update the array column for dual-write
    await supabase
      .from("contacts")
      .update({ tags: tagIds })
      .eq("id", contactId);
  }

  if (contactTagInserts.length > 0) {
    const { error: ctError } = await supabase.from("contact_tags").insert(contactTagInserts);
    if (ctError) console.warn(`  Warning on contact_tags: ${ctError.message}`);
  }
  console.log(`  ${contactTagInserts.length} contact-tag links created\n`);

  // -- 5g. Deals --
  console.log("Creating deals...");
  const dealInserts = DEALS.map((d, idx) => {
    const created = daysAgo(d.daysOld);
    const closingDate = d.stage === "won" || d.stage === "lost"
      ? isoDate(daysAgo(randInt(1, d.daysOld - 1)))
      : isoDate(daysFromNow(randInt(7, 60)));

    return {
      name: d.name,
      company_id: companyRows[d.company].id,
      contact_ids: d.contacts.map((ci) => contactRows[ci].id),
      category: d.category,
      stage: d.stage,
      amount: d.amount,
      expected_closing_date: closingDate,
      sales_id: salesId,
      index: idx,
      created_at: isoTimestamp(created),
      lost_reason: d.stage === "lost" ? "Price — went with a cheaper competitor" : null,
    };
  });

  const { data: dealRows, error: dealError } = await supabase
    .from("deals")
    .insert(dealInserts)
    .select();

  if (dealError) {
    console.error("Failed to create deals:", dealError.message);
    process.exit(1);
  }
  console.log(`  ${dealRows.length} deals created\n`);

  // -- 5h. Deal contacts (join table dual-write) --
  console.log("Creating deal-contact links...");
  const dealContactInserts = [];
  for (let i = 0; i < DEALS.length; i++) {
    for (const contactIdx of DEALS[i].contacts) {
      dealContactInserts.push({
        deal_id: dealRows[i].id,
        contact_id: contactRows[contactIdx].id,
      });
    }
  }

  if (dealContactInserts.length > 0) {
    const { error: dcError } = await supabase.from("deal_contacts").insert(dealContactInserts);
    if (dcError) console.warn(`  Warning on deal_contacts: ${dcError.message}`);
  }
  console.log(`  ${dealContactInserts.length} deal-contact links created\n`);

  // -- 5i. Contact notes --
  console.log("Creating contact notes...");
  const contactNoteInserts = CONTACT_NOTES.map((n) => ({
    contact_id: contactRows[n.contact].id,
    sales_id: salesId,
    text: n.text,
    date: isoTimestamp(daysAgo(n.daysAgo)),
    status: n.status,
  }));

  const { data: cnRows, error: cnError } = await supabase
    .from("contact_notes")
    .insert(contactNoteInserts)
    .select();

  if (cnError) {
    console.error("Failed to create contact notes:", cnError.message);
    process.exit(1);
  }
  console.log(`  ${cnRows.length} contact notes created\n`);

  // -- 5j. Deal notes --
  console.log("Creating deal notes...");
  const dealNoteInserts = DEAL_NOTES.map((n) => ({
    deal_id: dealRows[n.deal].id,
    sales_id: salesId,
    text: n.text,
    date: isoTimestamp(daysAgo(n.daysAgo)),
    type: n.type,
  }));

  const { data: dnRows, error: dnError } = await supabase
    .from("deal_notes")
    .insert(dealNoteInserts)
    .select();

  if (dnError) {
    console.error("Failed to create deal notes:", dnError.message);
    process.exit(1);
  }
  console.log(`  ${dnRows.length} deal notes created\n`);

  // -- 5k. Tasks --
  console.log("Creating tasks...");
  const taskInserts = TASK_TEMPLATES.map((t) => {
    const dueDate = t.dueDaysAgo != null
      ? daysAgo(t.dueDaysAgo)
      : daysFromNow(t.dueDaysFromNow);

    return {
      contact_id: contactRows[t.contact].id,
      sales_id: salesId,
      type: t.type,
      text: t.text,
      due_date: isoTimestamp(dueDate),
      done_date: t.done ? isoTimestamp(daysAgo(t.doneDaysAgo)) : null,
    };
  });

  const { data: taskRows, error: taskError } = await supabase
    .from("tasks")
    .insert(taskInserts)
    .select();

  if (taskError) {
    console.error("Failed to create tasks:", taskError.message);
    process.exit(1);
  }
  console.log(`  ${taskRows.length} tasks created\n`);

  // -- Summary --
  console.log("=== Seed Complete ===");
  console.log(`  1 sales user (nathan@hatchtheory.com / demo1234!)`);
  console.log(`  ${tagRows.length} tags`);
  console.log(`  ${companyRows.length} companies`);
  console.log(`  ${contactRows.length} contacts`);
  console.log(`  ${contactTagInserts.length} contact-tag links`);
  console.log(`  ${dealRows.length} deals (${DEALS.filter(d => !["won","lost"].includes(d.stage)).length} active, ${DEALS.filter(d => d.stage === "won").length} won, ${DEALS.filter(d => d.stage === "lost").length} lost)`);
  console.log(`  ${dealContactInserts.length} deal-contact links`);
  console.log(`  ${cnRows.length} contact notes`);
  console.log(`  ${dnRows.length} deal notes`);
  console.log(`  ${taskRows.length} tasks (${TASK_TEMPLATES.filter(t => !t.done && t.dueDaysAgo).length} overdue, ${TASK_TEMPLATES.filter(t => !t.done && t.dueDaysFromNow != null).length} upcoming, ${TASK_TEMPLATES.filter(t => t.done).length} done)`);
  console.log(`\nPipeline value: $${DEALS.filter(d => !["won","lost"].includes(d.stage)).reduce((s, d) => s + d.amount, 0).toLocaleString()}`);
  console.log(`Total won: $${DEALS.filter(d => d.stage === "won").reduce((s, d) => s + d.amount, 0).toLocaleString()}`);
}

// ---------------------------------------------------------------------------
// 6. Run
// ---------------------------------------------------------------------------
const shouldClean = !process.argv.includes("--no-clean");

try {
  if (shouldClean) await cleanAll();
  await seed();
} catch (err) {
  console.error("Seed failed:", err);
  process.exit(1);
}
