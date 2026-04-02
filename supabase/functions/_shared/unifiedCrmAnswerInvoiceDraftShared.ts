import type { ParsedUnifiedCrmInvoiceDraftQuestion } from "./unifiedCrmAnswerTypes.ts";
import {
  getNumber,
  getObjectArray,
  getString,
  isObject,
} from "./unifiedCrmAnswerUtils.ts";

export type SnapshotCollections = {
  openQuotes: Array<Record<string, unknown>>;
  activeProjects: Array<Record<string, unknown>>;
  recentClients: Array<Record<string, unknown>>;
};

export const getClientFinancials = (
  context: Record<string, unknown>,
  clientId: string,
) => {
  const snapshot = isObject(context.snapshot) ? context.snapshot : null;
  const financials = getObjectArray(snapshot?.clientFinancials);
  const match = financials.find(
    (item) => getString(item.clientId) === clientId,
  );

  if (!match) {
    return null;
  }

  const totalFees = getNumber(match.totalFees) ?? 0;
  const totalExpenses = getNumber(match.totalExpenses) ?? 0;
  const totalPaid = getNumber(match.totalPaid) ?? 0;
  const balanceDue = getNumber(match.balanceDue) ?? totalFees - totalPaid;

  return {
    totalFees,
    totalExpenses,
    totalPaid,
    balanceDue,
    hasUninvoicedServices: match.hasUninvoicedServices === true,
  };
};

export const getInvoiceDraftSnapshotCollections = (
  context: Record<string, unknown>,
): SnapshotCollections => {
  const snapshot = isObject(context.snapshot) ? context.snapshot : {};

  return {
    openQuotes: getObjectArray(snapshot.openQuotes),
    activeProjects: getObjectArray(snapshot.activeProjects),
    recentClients: getObjectArray(snapshot.recentClients),
  };
};

const findPreferredQuoteRecord = ({
  openQuotes,
  matchedClientId,
  matchedProjectId,
}: {
  openQuotes: SnapshotCollections["openQuotes"];
  matchedClientId: string | null;
  matchedProjectId: string | null;
}) => {
  if (matchedClientId) {
    return (
      openQuotes.find((item) => getString(item.clientId) === matchedClientId) ??
      null
    );
  }

  if (matchedProjectId) {
    return (
      openQuotes.find(
        (item) => getString(item.projectId) === matchedProjectId,
      ) ?? null
    );
  }

  return openQuotes[0] ?? null;
};

const findPreferredProjectRecord = ({
  activeProjects,
  matchedProject,
  matchedClientId,
  matchedProjectId,
}: {
  activeProjects: SnapshotCollections["activeProjects"];
  matchedProject: Record<string, unknown> | null;
  matchedClientId: string | null;
  matchedProjectId: string | null;
}) => {
  if (matchedProjectId) {
    return matchedProject;
  }

  if (matchedClientId) {
    return (
      activeProjects.find(
        (item) => getString(item.clientId) === matchedClientId,
      ) ?? null
    );
  }

  return activeProjects[0] ?? null;
};

export const buildQuoteInvoiceDraftQuestion = ({
  context,
  openQuotes,
  matchedClient,
  matchedClientId,
  matchedProjectId,
}: {
  context: Record<string, unknown>;
  openQuotes: SnapshotCollections["openQuotes"];
  matchedClient: Record<string, unknown> | null;
  matchedClientId: string | null;
  matchedProjectId: string | null;
}): ParsedUnifiedCrmInvoiceDraftQuestion | null => {
  const quote = findPreferredQuoteRecord({
    openQuotes,
    matchedClientId,
    matchedProjectId,
  });
  const quoteId = getString(quote?.quoteId);
  const quoteClientId = getString(quote?.clientId) ?? matchedClientId ?? null;

  if (!quoteId || !quoteClientId) {
    return null;
  }

  return {
    surface: "quote",
    recordId: quoteId,
    entityLabel:
      getString(quote?.description) ??
      `Preventivo ${getString(quote?.quoteNumber) ?? ""}`.trim(),
    clientName:
      getString(quote?.clientName) ??
      getString(matchedClient?.clientName) ??
      "Cliente",
    clientId: quoteClientId,
    financials: getClientFinancials(context, quoteClientId),
  };
};

export const buildProjectInvoiceDraftQuestion = ({
  context,
  activeProjects,
  recentClients,
  matchedClient,
  matchedProject,
  matchedClientId,
  matchedProjectId,
}: {
  context: Record<string, unknown>;
  activeProjects: SnapshotCollections["activeProjects"];
  recentClients: SnapshotCollections["recentClients"];
  matchedClient: Record<string, unknown> | null;
  matchedProject: Record<string, unknown> | null;
  matchedClientId: string | null;
  matchedProjectId: string | null;
}): ParsedUnifiedCrmInvoiceDraftQuestion | null => {
  const projectRecord = findPreferredProjectRecord({
    activeProjects,
    matchedProject,
    matchedClientId,
    matchedProjectId,
  });
  const projectId = getString(projectRecord?.projectId);
  const projectClientId =
    getString(projectRecord?.clientId) ?? matchedClientId ?? null;

  if (!projectId || !projectClientId) {
    return null;
  }

  return {
    surface: "project",
    recordId: projectId,
    entityLabel: getString(projectRecord?.projectName) ?? "Progetto",
    clientName:
      getString(
        recentClients.find(
          (item) => getString(item.clientId) === projectClientId,
        )?.clientName,
      ) ??
      getString(matchedClient?.clientName) ??
      "Cliente",
    clientId: projectClientId,
    financials: getClientFinancials(context, projectClientId),
  };
};

export const buildClientInvoiceDraftQuestion = ({
  context,
  recentClients,
  matchedClient,
}: {
  context: Record<string, unknown>;
  recentClients: SnapshotCollections["recentClients"];
  matchedClient: Record<string, unknown> | null;
}): ParsedUnifiedCrmInvoiceDraftQuestion | null => {
  const clientRecord = matchedClient ?? recentClients[0];
  const clientId = getString(clientRecord?.clientId);
  const clientName = getString(clientRecord?.clientName) ?? "Cliente";

  if (!clientId) {
    return null;
  }

  return {
    surface: "client",
    recordId: clientId,
    entityLabel: clientName,
    clientName,
    clientId,
    financials: getClientFinancials(context, clientId),
  };
};
