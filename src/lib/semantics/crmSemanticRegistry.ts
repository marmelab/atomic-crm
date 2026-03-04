import {
  clientSourceChoices,
  clientTypeChoices,
} from "@/components/atomic-crm/clients/clientTypes";
import {
  paymentMethodChoices,
  paymentStatusChoices,
  paymentTypeChoices,
} from "@/components/atomic-crm/payments/paymentTypes";
import {
  projectCategoryChoices,
  projectStatusChoices,
  projectTvShowChoices,
} from "@/components/atomic-crm/projects/projectTypes";
import { quoteStatuses } from "@/components/atomic-crm/quotes/quotesTypes";
import type { ConfigurationContextValue } from "@/components/atomic-crm/root/ConfigurationContext";
import { defaultConfiguration } from "@/components/atomic-crm/root/defaultConfiguration";
import type { Payment, Quote, Service } from "@/components/atomic-crm/types";

export type SemanticDictionaryItem = {
  value: string;
  label: string;
  description?: string;
  origin: "fixed" | "configuration";
};

export type CrmSemanticRegistry = {
  dictionaries: {
    clientTypes: SemanticDictionaryItem[];
    acquisitionSources: SemanticDictionaryItem[];
    projectCategories: SemanticDictionaryItem[];
    projectStatuses: SemanticDictionaryItem[];
    projectTvShows: SemanticDictionaryItem[];
    quoteStatuses: SemanticDictionaryItem[];
    quoteServiceTypes: SemanticDictionaryItem[];
    serviceTypes: SemanticDictionaryItem[];
    paymentTypes: SemanticDictionaryItem[];
    paymentMethods: SemanticDictionaryItem[];
    paymentStatuses: SemanticDictionaryItem[];
  };
  fields: {
    descriptions: Array<{
      resource:
        | "clients"
        | "contacts"
        | "quotes"
        | "payments"
        | "services"
        | "expenses";
      field: string;
      label: string;
      meaning: string;
    }>;
    dates: Array<{
      resource: "clients" | "quotes" | "payments" | "services" | "expenses";
      field: string;
      label: string;
      meaning: string;
    }>;
  };
  rules: {
    serviceNetValue: {
      formula: string;
      taxableFlagField: "is_taxable";
      meaning: string;
    };
    paymentTaxability: {
      derivation: string;
      meaning: string;
    };
    travelReimbursement: {
      formula: string;
      defaultKmRate: number;
      meaning: string;
    };
    dateRanges: {
      allDayField: "all_day";
      meaning: string;
    };
    quoteStatusEmail: {
      outstandingDueFormula: string;
      automaticBlockerField: "services.is_taxable";
      meaning: string;
    };
    invoiceImport: {
      customerInvoiceResource: "payments";
      supplierInvoiceResource: "expenses";
      confirmationRule: string;
      meaning: string;
    };
    unifiedAiReadContext: {
      scope: string;
      freshnessField: "generatedAt";
      meaning: string;
    };
    unifiedAiWriteDraft: {
      approvedResource: "payments";
      confirmationRule: string;
      meaning: string;
    };
    workflowAutomations: {
      scope: string;
      meaning: string;
    };
  };
};

const mapFixedChoices = <
  T extends ReadonlyArray<{
    id?: string;
    value?: string;
    name?: string;
    label?: string;
    description?: string;
  }>,
>(
  choices: T,
): SemanticDictionaryItem[] =>
  choices.map((choice) => ({
    value: choice.id ?? choice.value ?? "",
    label: choice.name ?? choice.label ?? "",
    description: choice.description,
    origin: "fixed",
  }));

const mapConfigChoices = (
  choices: ConfigurationContextValue["serviceTypeChoices"],
): SemanticDictionaryItem[] =>
  choices.map((choice) => ({
    value: choice.value,
    label: choice.label,
    description: choice.description,
    origin: "configuration",
  }));

export const getDefaultKmRate = (
  config?: Pick<ConfigurationContextValue, "operationalConfig"> | null,
) =>
  Number(config?.operationalConfig?.defaultKmRate) ||
  defaultConfiguration.operationalConfig.defaultKmRate;

export const calculateKmReimbursement = ({
  kmDistance,
  kmRate,
  defaultKmRate = defaultConfiguration.operationalConfig.defaultKmRate,
}: {
  kmDistance?: number | null;
  kmRate?: number | null;
  defaultKmRate?: number;
}) => Number(kmDistance ?? 0) * Number(kmRate ?? defaultKmRate);

export const calculateServiceNetValue = (
  service: Pick<Service, "fee_shooting" | "fee_editing" | "fee_other" | "discount">,
) =>
  Number(service.fee_shooting) +
  Number(service.fee_editing) +
  Number(service.fee_other) -
  Number(service.discount);

export const calculateTaxableServiceNetValue = (
  service: Pick<
    Service,
    "fee_shooting" | "fee_editing" | "fee_other" | "discount" | "is_taxable"
  >,
) => (service.is_taxable === false ? 0 : calculateServiceNetValue(service));

export const isPaymentTaxable = (
  _payment: Pick<Payment, "project_id" | "quote_id">,
  context: {
    projectServices: Array<Pick<Service, "is_taxable">>;
    quote?: Pick<Quote, "is_taxable"> | null;
  },
) => {
  if (context.projectServices.length > 0) {
    return context.projectServices.some((service) => service.is_taxable !== false);
  }

  if (context.quote) {
    return context.quote.is_taxable !== false;
  }

  return true;
};

export const buildCrmSemanticRegistry = (
  config?: Partial<ConfigurationContextValue>,
): CrmSemanticRegistry => {
  const mergedConfig = { ...defaultConfiguration, ...config };

  return {
    dictionaries: {
      clientTypes: mapFixedChoices(clientTypeChoices),
      acquisitionSources: mapFixedChoices(clientSourceChoices),
      projectCategories: mapFixedChoices(projectCategoryChoices),
      projectStatuses: mapFixedChoices(projectStatusChoices),
      projectTvShows: mapFixedChoices(projectTvShowChoices),
      quoteStatuses: mapFixedChoices(quoteStatuses),
      quoteServiceTypes: mapConfigChoices(mergedConfig.quoteServiceTypes),
      serviceTypes: mapConfigChoices(mergedConfig.serviceTypeChoices),
      paymentTypes: mapFixedChoices(paymentTypeChoices),
      paymentMethods: mapFixedChoices(paymentMethodChoices),
      paymentStatuses: mapFixedChoices(paymentStatusChoices),
    },
    fields: {
      descriptions: [
        {
          resource: "clients",
          field: "billing_name",
          label: "Denominazione fiscale",
          meaning:
            "Nome fiscale o ragione sociale che compare nei documenti di fatturazione, distinto dal nome operativo se serve.",
        },
        {
          resource: "clients",
          field: "vat_number",
          label: "Partita IVA",
          meaning:
            "Identificativo IVA del cliente da tenere separato dal codice fiscale quando disponibile.",
        },
        {
          resource: "clients",
          field: "fiscal_code",
          label: "Codice fiscale",
          meaning:
            "Codice fiscale del cliente, separato dalla partita IVA anche quando coincidono.",
        },
        {
          resource: "clients",
          field: "billing_address_street",
          label: "Via / Piazza fatturazione",
          meaning:
            "Prima riga dell'indirizzo fiscale usato per fatture o documenti elettronici.",
        },
        {
          resource: "clients",
          field: "billing_city",
          label: "Comune fatturazione",
          meaning:
            "Comune fiscale del cliente, da leggere insieme a CAP, provincia e nazione.",
        },
        {
          resource: "clients",
          field: "billing_sdi_code",
          label: "Codice destinatario",
          meaning:
            "Codice SDI / destinatario per la fatturazione elettronica quando presente.",
        },
        {
          resource: "clients",
          field: "billing_pec",
          label: "PEC fatturazione",
          meaning:
            "Casella PEC usata come recapito fiscale del cliente quando disponibile.",
        },
        {
          resource: "quotes",
          field: "description",
          label: "Descrizione preventivo",
          meaning: "Riepilogo breve di ciò che stai proponendo al cliente.",
        },
        {
          resource: "contacts",
          field: "title",
          label: "Ruolo referente",
          meaning:
            "Ruolo o qualifica della persona di contatto, utile per capire la relazione operativa con il cliente.",
        },
        {
          resource: "contacts",
          field: "background",
          label: "Note referente",
          meaning:
            "Contesto libero sulla persona, da usare solo come supporto dopo aver letto le relazioni strutturate con cliente e progetti.",
        },
        {
          resource: "payments",
          field: "notes",
          label: "Note pagamento",
          meaning: "Contesto libero sul pagamento: accordi, dettagli o eccezioni.",
        },
        {
          resource: "services",
          field: "notes",
          label: "Note servizio",
          meaning: "Annotazioni operative del lavoro svolto o da ricordare.",
        },
        {
          resource: "expenses",
          field: "description",
          label: "Descrizione spesa",
          meaning: "Spiega cosa rappresenta la spesa o il credito registrato.",
        },
      ],
      dates: [
        {
          resource: "services",
          field: "service_date",
          label: "Data inizio servizio",
          meaning: "Quando il lavoro inizia davvero.",
        },
        {
          resource: "services",
          field: "service_end",
          label: "Data fine servizio",
          meaning: "Quando il lavoro finisce, se diverso dall'inizio.",
        },
        {
          resource: "quotes",
          field: "event_start",
          label: "Data inizio evento",
          meaning: "Quando il lavoro preventivato dovrebbe iniziare.",
        },
        {
          resource: "quotes",
          field: "event_end",
          label: "Data fine evento",
          meaning: "Quando il lavoro preventivato dovrebbe finire.",
        },
        {
          resource: "payments",
          field: "payment_date",
          label: "Data pagamento",
          meaning: "Quando il pagamento è stato o sarà ricevuto.",
        },
        {
          resource: "expenses",
          field: "expense_date",
          label: "Data spesa",
          meaning: "Quando la spesa o il credito si riferiscono davvero.",
        },
      ],
    },
    rules: {
      serviceNetValue: {
        formula: "fee_shooting + fee_editing + fee_other - discount",
        taxableFlagField: "is_taxable",
        meaning:
          "Il valore operativo del servizio nasce dai compensi netti; il flag is_taxable decide se quel valore entra anche nella base fiscale.",
      },
      paymentTaxability: {
        derivation:
          "display: project services is_taxable OR quote.is_taxable OR default true; fiscal model: taxabilityDefaults config (nonTaxableCategories, nonTaxableClientIds)",
        meaning:
          "Per la visualizzazione individuale, la tassabilita' e' derivata dai servizi/preventivi collegati. Per il calcolo fiscale annuale (principio di cassa), la tassabilita' e' derivata dalla config taxabilityDefaults.",
      },
      travelReimbursement: {
        formula: "km_distance * km_rate",
        defaultKmRate: getDefaultKmRate(mergedConfig),
        meaning:
          "Il rimborso spostamento deriva sempre da km percorsi per tariffa km, con una tariffa predefinita condivisa. Se la chat AI unificata propone una trasferta km calcolata tramite routing, quei km restano sempre un suggerimento modificabile prima del salvataggio su `expenses/create`. Lo stesso criterio vale anche nel calcolatore tratta manuale riusato nelle UI di spese, servizi e puntate rapide: la tariffa parte dal default condiviso ma resta sempre correggibile dall'utente prima di applicare km e costo stimato.",
      },
      dateRanges: {
        allDayField: "all_day",
        meaning:
          "Il flag all_day decide se le date vanno lette come giorno intero o come data/ora precisa.",
      },
      quoteStatusEmail: {
        outstandingDueFormula:
          "quote.amount - sum(linked payments where status = 'ricevuto')",
        automaticBlockerField: "services.is_taxable",
        meaning:
          "Le mail cliente sui cambi stato preventivo restano manuali e il residuo mostrato al cliente guarda solo gli incassi gia ricevuti; ogni invio automatico va bloccato se esistono servizi con is_taxable = false.",
      },
      invoiceImport: {
        customerInvoiceResource: "payments",
        supplierInvoiceResource: "expenses",
        confirmationRule:
          "nessuna scrittura nel CRM prima della conferma esplicita utente",
        meaning:
          "L'import fatture nella chat AI unificata deve proporre record strutturati, trasportare anche l'anagrafica fiscale letta dal documento e poi mappare le fatture cliente su payments e le fatture/costi fornitore su expenses solo dopo conferma utente. La conferma reale deve passare da validazioni server-side, coerenza cliente/progetto, controllo duplicati stretti per invoice_ref quando disponibile e rollback completo del batch se un record non e' confermabile. Se manca il cliente, il passo corretto e' aprire il form cliente gia precompilato con quei campi, non creare automaticamente il record.",
      },
      unifiedAiReadContext: {
        scope:
          "clients + contacts + project_contacts + quotes + projects + payments + expenses",
        freshnessField: "generatedAt",
        meaning:
          "Il contesto CRM-wide del launcher unificato e' una snapshot read-only dei moduli core; sia la snapshot sia le risposte AI che la usano restano di sola lettura, gli handoff successivi possono solo puntare a route o azioni gia approvate, una recommendation primaria puo comparire solo se costruita deterministicamente dal sistema, e gli href di handoff possono trasportare solo prefills/search params gia supportati dalle superfici esistenti. Dentro quella snapshot i clienti recenti devono esporre anche il profilo fiscale essenziale e i recapiti di fatturazione principali gia presenti nel CRM, i referenti recenti devono esporre recapiti e cliente/progetti collegati, e i progetti attivi devono riportare i referenti associati con priorita' ai contatti primari. Quando esistono relazioni strutturate cliente-progetto-referente, quelle relazioni devono avere priorita' interpretativa rispetto a note libere o inferenze sul testo. Le superfici di arrivo possono poi calcolare o ricevere solo suggerimenti deterministici locali, come il residuo ancora non collegato di un preventivo, i financials aggregati di un progetto attivo derivati da servizi, spese e pagamenti ricevuti, oppure una stima tratta km ottenuta da un servizio routing esterno ma sempre correggibile prima della scrittura. Ogni futura scrittura deve passare da un workflow dedicato con conferma esplicita.",
      },
      workflowAutomations: {
        scope: "workflows (activeWorkflows nella snapshot)",
        meaning:
          "Le automazioni attive nel CRM sono visibili nella snapshot come activeWorkflows. Quando l'utente chiede qualcosa che potrebbe essere automatizzato, l'AI deve prima verificare se esiste gia un'automazione equivalente: se si, la segnala e propone handoff al dettaglio; se no, puo suggerire di crearne una con handoff precompilato a workflows/create. I campi precompilati devono essere coerenti con lo scopo descritto dall'utente nel contesto della conversazione.",
      },
      unifiedAiWriteDraft: {
        approvedResource: "payments",
        confirmationRule:
          "nessuna scrittura dal launcher; la conferma resta su superfici pagamento gia approvate",
        meaning:
          "I write-draft del launcher possono solo proporre bozze pagamento strutturate, modificabili in chat e trasportabili verso superfici pagamento gia approvate: `payments/create` per il percorso quote-driven e `project quick payment` per il percorso project-driven. La scrittura reale parte solo dalla superficie di destinazione con conferma esplicita dell'utente. Se l'utente ha gia corretto esplicitamente l'importo nel launcher, `payments/create` deve preservare quel valore e offrire solo in alternativa il suggerimento locale deterministico del residuo, ma solo finche il form resta sullo stesso preventivo della bozza. Quando quel contesto non vale piu, la UI deve segnalarlo esplicitamente e tornare alla semantica locale del form. Sul quick payment di progetto la bozza puo portare importo, tipo e stato gia derivati dai financials del progetto attivo. Dopo il primo edit manuale dell'importo sul form, il ricalcolo automatico non deve piu riprendersi il controllo del campo.",
      },
    },
  };
};
