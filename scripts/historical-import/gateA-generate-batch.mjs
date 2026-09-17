// Gate A representative batch — SYNTHETIC data only, no real client PII.
// Runs the REAL, unmodified importPerson() (orchestrate.mjs) against the
// SQL-capturing shim, covering every entity type/behavior the historical
// writer touches: Contact CREATE, Deal + supplementary stage events,
// Application with offer/intended-cohort (with and without a Deal), a
// multi-source-submission Application collapse (Dax-shaped), Waitlist
// Entry, Enrollment + status event, sales_call, client_session.
//
// Usage: node gateA-generate-batch.mjs <pass> <outfile>
//   pass=1: fresh state, writes gateA_pass1.sql
//   pass=2: seeds prior state from gateA_pass1_result.json (produced by
//           the report step after querying the DB post-COMMIT), proving
//           genuine second-pass idempotency against REAL committed state.

import fs from "node:fs";
import { importPerson } from "./orchestrate.mjs";
import { makeShimClient } from "./gateA-sql-shim.mjs";

const [, , passArg, outFile, nextIdsFile, priorStateFile] = process.argv;
const pass = Number(passArg);
const nextIdByTable = JSON.parse(fs.readFileSync(nextIdsFile, "utf8"));

let priorState = { ledger: new Map(), contactsByEmail: new Map() };
if (pass === 2) {
  const raw = JSON.parse(fs.readFileSync(priorStateFile, "utf8"));
  priorState = {
    ledger: new Map(Object.entries(raw.ledger)),
    contactsByEmail: new Map(Object.entries(raw.contactsByEmail)),
  };
}

const rulings = {
  canonicalStripeCustomerOverrides: {},
  pcEmails: ["gatea.pc@example.invalid"],
  ccRepresentable: {
    "gatea.cc@example.invalid": { offerId: 2, dealStage: "won" },
  },
  ccContactOnly: [],
  explicitOfferOverrides: {
    "gatea.pc@example.invalid": {
      offerId: 1,
      evidence: "synthetic-acuity-type",
    },
  },
};
const batchId = "gate-a-proof-2026-09-16-regression2";

const people = [
  {
    // Ordinary Pipeline LE Deal — the exact path real Postgres rejected
    // the first time (Offer + stage both now resolve: Program field +
    // "Call Scheduled" -> call_booked).
    canonicalEmail: "gatea.plain@example.invalid",
    altEmails: [],
    names: ["Gate A Plain"],
    operation: "CREATE",
    pipelineStages: ["Call Scheduled"],
    pipelinePrograms: ["The Living Example (1:1)"],
    hasApplication: false,
    waitlist: { LE: false, GYU: false },
    stripe: { customer: null },
    acuityEarliestCallDate: "2026-01-05",
    structuredAcuityAppointments: [],
    matchedApplications: [
      {
        sourceUrl: "https://app.notion.com/gatea-plain-app",
        program: "LE",
        status: "Approved",
        submittedAt: "2026-01-05T10:00:00Z",
        rawFields: {},
      },
    ],
  },
  {
    // Ordinary Pipeline GYU Deal, Active Client -> won.
    canonicalEmail: "gatea.gyupipeline@example.invalid",
    altEmails: [],
    names: ["Gate A GYU Pipeline"],
    operation: "CREATE",
    pipelineStages: ["Active Client"],
    pipelinePrograms: ["Growing Yourself Up (GYU)"],
    hasApplication: false,
    waitlist: { LE: false, GYU: false },
    stripe: { customer: null },
    acuityEarliestCallDate: "2026-01-20",
    structuredAcuityAppointments: [],
  },
  {
    // PC Deal — Offer via explicitOfferOverrides (mirrors the real
    // Acuity-sales-call-type resolution), stage/outcome from the
    // pre-existing PC_DEAL_STAGE/PC_DEAL_OUTCOME constants.
    canonicalEmail: "gatea.pc@example.invalid",
    altEmails: [],
    names: ["Gate A Potential Client"],
    operation: "CREATE",
    pipelineStages: [],
    hasApplication: false,
    waitlist: { LE: false, GYU: false },
    stripe: { customer: "cus_gateA_synthetic", customerCreated: "2026-01-10" },
    acuityEarliestCallDate: "2026-01-02",
    structuredAcuityAppointments: [],
  },
  {
    // CC/ruling Deal — offerId + stage both come directly from the ruling.
    canonicalEmail: "gatea.cc@example.invalid",
    altEmails: [],
    names: ["Gate A CC Ruling"],
    operation: "CREATE",
    pipelineStages: [],
    hasApplication: false,
    waitlist: { LE: false, GYU: false },
    stripe: { customer: null },
    acuityEarliestCallDate: "2026-01-12",
    structuredAcuityAppointments: [],
  },
  {
    canonicalEmail: "gatea.noapp@example.invalid",
    altEmails: [],
    names: ["Gate A No Deal"],
    operation: "CREATE",
    pipelineStages: [],
    hasApplication: false,
    waitlist: { LE: false, GYU: false },
    stripe: { customer: null },
    structuredAcuityAppointments: [],
    matchedApplications: [
      {
        sourceUrl: "https://app.notion.com/gatea-nodeal-app",
        program: "GYU",
        status: "Pending",
        submittedAt: "2026-02-01T00:00:00Z",
        rawFields: {},
        intendedCohortName: null,
      },
    ],
  },
  {
    canonicalEmail: "gatea.waitlist@example.invalid",
    altEmails: [],
    names: ["Gate A Waitlist"],
    operation: "CREATE",
    pipelineStages: [],
    hasApplication: null,
    waitlist: { LE: true, GYU: false },
    stripe: { customer: null },
    structuredAcuityAppointments: [],
    waitlistJoinedAt: { LE: "2026-01-15" },
  },
  {
    canonicalEmail: "gatea.active@example.invalid",
    altEmails: [],
    names: ["Gate A Active Client"],
    operation: "CREATE",
    pipelineStages: ["Active Client"],
    pipelinePrograms: ["The Living Example (1:1)"],
    hasApplication: false,
    waitlist: { LE: false, GYU: false },
    stripe: { customer: null },
    acuityEarliestCallDate: "2026-01-20",
    structuredAcuityAppointments: [],
  },
  {
    canonicalEmail: "gatea.salescall@example.invalid",
    altEmails: [],
    names: ["Gate A Sales Call"],
    operation: "CREATE",
    pipelineStages: ["Call Scheduled"],
    pipelinePrograms: ["Growing Yourself Up (GYU)"],
    hasApplication: false,
    waitlist: { LE: false, GYU: false },
    stripe: { customer: null },
    acuityEarliestCallDate: "2026-01-25",
    structuredAcuityAppointments: [
      {
        id: "gateA-appt-sales",
        appointmentTypeID: 64654501,
        datetime: "2026-01-25T15:00:00Z",
      },
    ],
  },
  {
    canonicalEmail: "gatea.clientsession@example.invalid",
    altEmails: [],
    names: ["Gate A Client Session"],
    operation: "CREATE",
    pipelineStages: ["Active Client"],
    pipelinePrograms: ["The Living Example (1:1)"],
    hasApplication: false,
    waitlist: { LE: false, GYU: false },
    stripe: { customer: null },
    acuityEarliestCallDate: "2026-01-26",
    structuredAcuityAppointments: [
      {
        id: "gateA-appt-session",
        appointmentTypeID: 90522599,
        datetime: "2026-01-26T15:00:00Z",
      },
    ],
  },
];

const client = makeShimClient(nextIdByTable, priorState);
const results = [];

for (const person of people) {
  const r = await importPerson(client, person, rulings, { batchId });
  results.push({ email: person.canonicalEmail, ...r });
}

const body = [
  "begin;",
  "select set_historical_migration_mode(true);",
  ...client.statements,
  "select set_historical_migration_mode(false);",
  "commit;",
].join("\n");
fs.writeFileSync(outFile, body);

// eslint-disable-next-line no-console
console.log(
  JSON.stringify(
    {
      pass,
      personCount: people.length,
      statementCount: client.statements.length,
      results,
    },
    null,
    2,
  ),
);
