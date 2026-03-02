import { execFileSync } from "node:child_process";

const TEST_FILE_RE = /\.(test|spec)\.[cm]?[jt]sx?$/;

const exact =
  (...names) =>
  (path) =>
    names.includes(path);
const startsWith =
  (...prefixes) =>
  (path) =>
    prefixes.some((prefix) => path.startsWith(prefix));
const anyOf =
  (...matchers) =>
  (path) =>
    matchers.some((matcher) => matcher(path));

const normalizePath = (path) => path.replace(/\\/g, "/").replace(/^\.\//, "");

const getStagedPaths = () => {
  if (process.argv.length > 2) {
    return process.argv.slice(2).map(normalizePath).filter(Boolean);
  }

  const output = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
    { encoding: "utf8" },
  ).trim();

  if (!output) {
    return [];
  }

  return output.split("\n").map(normalizePath).filter(Boolean);
};

const continuityDocs = [
  "docs/README.md",
  "docs/development-continuity-map.md",
  "docs/historical-analytics-handoff.md",
  "docs/historical-analytics-backlog.md",
  "docs/architecture.md",
  "docs/contacts-client-project-architecture.md",
  "docs/data-import-analysis.md",
  "docs/local-truth-rebuild.md",
  "Gestionale_Rosario_Furnari_Specifica.md",
];

const continuityDocMatcher = exact(...continuityDocs);

const isRealProductCode = (path) => {
  if (TEST_FILE_RE.test(path)) {
    return false;
  }

  return (
    path.startsWith("src/components/atomic-crm/") ||
    path.startsWith("src/lib/") ||
    path.startsWith("supabase/functions/") ||
    path.startsWith("supabase/migrations/")
  );
};

const rules = [
  {
    id: "claude-agents-link",
    description:
      "CLAUDE.md non deve evolvere come prompt parallelo: ogni suo cambiamento va accompagnato da AGENTS.md.",
    when: exact("CLAUDE.md"),
    require: exact("AGENTS.md"),
    requireLabel: "AGENTS.md",
    help: "AGENTS.md e' la fonte condivisa canonica. CLAUDE.md deve restare solo un wrapper complementare e collegato.",
  },
  {
    id: "product-doc-sync",
    description:
      "Le modifiche a comportamento reale del prodotto devono sempre trascinarsi dietro almeno un aggiornamento nei docs di continuita'.",
    when: isRealProductCode,
    require: continuityDocMatcher,
    requireLabel: continuityDocs.join(", "),
    help: "Se hai toccato codice prodotto, aggiorna almeno un documento canonico/working che spieghi il cambiamento o la sua assenza di impatto architetturale.",
  },
  {
    id: "domain-structure",
    description:
      "Le modifiche strutturali a schema/provider/resource devono aggiornare anche la fotografia architetturale.",
    when: anyOf(
      startsWith(
        "supabase/migrations/",
        "src/components/atomic-crm/providers/",
        "src/components/atomic-crm/root/CRM.tsx",
        "src/components/atomic-crm/root/i18nProvider.tsx",
      ),
      exact("src/components/atomic-crm/types.ts"),
    ),
    require: exact(
      "docs/architecture.md",
      "docs/development-continuity-map.md",
    ),
    requireLabel: "docs/architecture.md, docs/development-continuity-map.md",
    help: "Schema, provider e resource sono fonte di impatto trasversale: senza aggiornare l'architettura o la continuity map il repo perde coerenza.",
  },
  {
    id: "client-contact-project-domain",
    description:
      "Il dominio clienti/referenti/progetti ha una documentazione canonica dedicata.",
    when: anyOf(
      startsWith(
        "src/components/atomic-crm/clients/",
        "src/components/atomic-crm/contacts/",
        "src/components/atomic-crm/projects/",
      ),
      exact(
        "src/lib/ai/unifiedCrmReadContext.ts",
        "src/components/atomic-crm/ai/UnifiedCrmReadSnapshot.tsx",
      ),
      startsWith("supabase/functions/unified_crm_answer/"),
      exact("supabase/functions/_shared/unifiedCrmAnswer.ts"),
    ),
    require: exact(
      "docs/contacts-client-project-architecture.md",
      "docs/architecture.md",
    ),
    requireLabel:
      "docs/contacts-client-project-architecture.md, docs/architecture.md",
    help: "Se cambia questo dominio, la chat AI e le relazioni cliente/progetto/referente non possono restare implicite.",
  },
  {
    id: "invoice-import-domain",
    description:
      "Il flusso import documenti ha casi reali e mapping dedicati che non devono divergere dal codice.",
    when: anyOf(
      exact(
        "src/components/atomic-crm/ai/AiInvoiceImportView.tsx",
        "src/components/atomic-crm/ai/InvoiceImportDraftEditor.tsx",
        "src/lib/ai/invoiceImport.ts",
        "src/lib/ai/invoiceImportProvider.ts",
      ),
      startsWith(
        "supabase/functions/invoice_import_extract/",
        "supabase/functions/invoice_import_confirm/",
      ),
    ),
    require: exact(
      "docs/data-import-analysis.md",
      "docs/historical-analytics-handoff.md",
    ),
    requireLabel:
      "docs/data-import-analysis.md, docs/historical-analytics-handoff.md",
    help: "L'import documenti e' un punto ad alto rischio: aggiorna il caso reale o l'handoff operativo nello stesso commit.",
  },
  {
    id: "ai-analytics-domain",
    description:
      "AI unificata, semantiche e analytics richiedono continuita' operativa aggiornata.",
    when: anyOf(
      startsWith(
        "src/components/atomic-crm/ai/",
        "src/components/atomic-crm/dashboard/",
        "src/lib/analytics/",
        "src/lib/semantics/",
      ),
      exact(
        "src/lib/ai/unifiedCrmAssistant.ts",
        "src/lib/ai/unifiedCrmReadContext.ts",
        "supabase/functions/_shared/unifiedCrmAnswer.ts",
      ),
      startsWith(
        "supabase/functions/unified_crm_answer/",
        "supabase/functions/historical_",
        "supabase/functions/annual_",
      ),
    ),
    require: exact(
      "docs/historical-analytics-handoff.md",
      "docs/historical-analytics-backlog.md",
      "docs/architecture.md",
    ),
    requireLabel:
      "docs/historical-analytics-handoff.md, docs/historical-analytics-backlog.md, docs/architecture.md",
    help: "Le capability AI non devono vivere solo nel codice: aggiorna handoff/backlog o architettura.",
  },
  {
    id: "config-driven-settings",
    description:
      "Se tocchi configurazione condivisa, devi verificare anche il percorso Settings oppure documentare esplicitamente perche' non serve.",
    when: exact(
      "src/components/atomic-crm/root/defaultConfiguration.ts",
      "src/components/atomic-crm/root/ConfigurationContext.tsx",
    ),
    require: anyOf(
      startsWith("src/components/atomic-crm/settings/"),
      exact(
        "docs/development-continuity-map.md",
        "docs/historical-analytics-handoff.md",
        "docs/architecture.md",
      ),
    ),
    requireLabel:
      "src/components/atomic-crm/settings/** oppure docs/development-continuity-map.md / docs/historical-analytics-handoff.md / docs/architecture.md",
    help: "Questo evita il rischio ricorrente di cambiare una regola configurabile senza rifletterla nella UI Settings o senza lasciare traccia del motivo.",
  },
];

const stagedPaths = getStagedPaths();

if (stagedPaths.length === 0) {
  process.exit(0);
}

const failures = [];

for (const rule of rules) {
  const impactedPaths = stagedPaths.filter(rule.when);
  if (impactedPaths.length === 0) {
    continue;
  }

  const satisfied = stagedPaths.some(rule.require);
  if (satisfied) {
    continue;
  }

  failures.push({
    ...rule,
    impactedPaths,
  });
}

if (failures.length === 0) {
  process.exit(0);
}

console.error("\nContinuity check failed.\n");

for (const failure of failures) {
  console.error(`- [${failure.id}] ${failure.description}`);
  console.error(
    `  Impacted files: ${failure.impactedPaths.slice(0, 6).join(", ")}`,
  );
  if (failure.impactedPaths.length > 6) {
    console.error(
      `  Impacted files: +${failure.impactedPaths.length - 6} altri file nello stesso gruppo`,
    );
  }
  console.error(`  Required companion: ${failure.requireLabel}`);
  console.error(`  Why: ${failure.help}\n`);
}

console.error(
  "Reading order: docs/README.md -> docs/development-continuity-map.md -> docs/historical-analytics-handoff.md -> docs/architecture.md\n",
);

process.exit(1);
