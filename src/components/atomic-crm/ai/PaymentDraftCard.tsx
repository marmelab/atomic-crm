import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type UnifiedCrmPaymentDraft } from "@/lib/ai/unifiedCrmAssistant";

import {
  buildPaymentCreatePathFromDraft,
  buildProjectQuickPaymentPathFromDraft,
} from "../payments/paymentLinking";
import {
  paymentStatusChoices,
  paymentTypeChoices,
} from "../payments/paymentTypes";

const formatCurrency = (value: number) =>
  value.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });

export const PaymentDraftCard = ({
  draft,
  routePrefix,
  onChange,
  onNavigate,
}: {
  draft: UnifiedCrmPaymentDraft;
  routePrefix: string;
  onChange: (draft: UnifiedCrmPaymentDraft) => void;
  onNavigate?: () => void;
}) => {
  const normalizedAmount =
    Number.isFinite(draft.amount) && draft.amount > 0 ? draft.amount : 0;
  const href =
    normalizedAmount > 0
      ? draft.originActionId === "project_quick_payment"
        ? (() => {
            const path = buildProjectQuickPaymentPathFromDraft({
              draft: {
                client_id: draft.clientId,
                project_id: draft.projectId,
                payment_type: draft.paymentType,
                amount: normalizedAmount,
                status: draft.status,
                launcherAction: draft.originActionId,
                draftKind: draft.draftKind,
              },
            });

            return path ? `${routePrefix}${path.replace(/^\//, "")}` : null;
          })()
        : `${routePrefix}${buildPaymentCreatePathFromDraft({
            draft: {
              quote_id: draft.quoteId,
              client_id: draft.clientId,
              project_id: draft.projectId,
              payment_type: draft.paymentType,
              amount: normalizedAmount,
              status: draft.status,
              launcherAction: draft.originActionId,
              draftKind: draft.draftKind,
            },
          }).replace(/^\//, "")}`
      : null;
  const ctaLabel =
    draft.originActionId === "project_quick_payment"
      ? "Apri quick payment del progetto con questa bozza"
      : "Apri form pagamenti con questa bozza";
  const helperCopy =
    draft.originActionId === "project_quick_payment"
      ? "La scrittura non parte da qui: apri il quick payment del progetto con la bozza e conferma li dentro."
      : "La scrittura non parte da qui: apri il form pagamenti con la bozza e conferma li dentro.";
  // rimborso is intentionally excluded: refunds to clients are rare,
  // sensitive operations done only via the manual payments CRUD.
  const allowedPaymentTypes = new Set([
    "acconto",
    "saldo",
    "parziale",
    "rimborso_spese",
  ]);

  return (
    <div className="space-y-3 rounded-2xl border border-[#2C3E50]/20 bg-[#E8EDF2] px-4 py-4 dark:bg-[#2C3E50]/20">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-[#2C3E50] dark:text-[#E8EDF2]">
            Bozza pagamento proposta
          </p>
          <p className="text-xs text-[#2C3E50]/70 dark:text-[#E8EDF2]/70">
            {draft.explanation}
          </p>
        </div>
        <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
          {formatCurrency(normalizedAmount)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge
          variant="outline"
          className="border-[#2C3E50]/30 text-[#2C3E50] dark:text-[#E8EDF2]"
        >
          Cliente {draft.clientId}
        </Badge>
        {draft.quoteId ? (
          <Badge
            variant="outline"
            className="border-[#2C3E50]/30 text-[#2C3E50] dark:text-[#E8EDF2]"
          >
            Preventivo {draft.quoteId}
          </Badge>
        ) : null}
        {draft.projectId ? (
          <Badge
            variant="outline"
            className="border-[#2C3E50]/30 text-[#2C3E50] dark:text-[#E8EDF2]"
          >
            Progetto {draft.projectId}
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="payment-draft-type">Tipo</Label>
          <select
            id="payment-draft-type"
            aria-label="Tipo"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            value={draft.paymentType}
            onChange={(event) =>
              onChange({
                ...draft,
                paymentType: event.target
                  .value as UnifiedCrmPaymentDraft["paymentType"],
              })
            }
          >
            {paymentTypeChoices
              .filter((choice) => allowedPaymentTypes.has(choice.id))
              .map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.name}
                </option>
              ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="payment-draft-amount">Importo</Label>
          <Input
            id="payment-draft-amount"
            type="number"
            min="0.01"
            step="0.01"
            value={Number.isFinite(draft.amount) ? draft.amount : ""}
            onChange={(event) =>
              onChange({
                ...draft,
                amount: Number(event.target.value),
              })
            }
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="payment-draft-status">Stato</Label>
          <select
            id="payment-draft-status"
            aria-label="Stato"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            value={draft.status}
            onChange={(event) =>
              onChange({
                ...draft,
                status: event.target.value as UnifiedCrmPaymentDraft["status"],
              })
            }
          >
            {paymentStatusChoices
              .filter(
                (choice) =>
                  choice.id === "in_attesa" || choice.id === "ricevuto",
              )
              .map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {helperCopy} Importo attuale {formatCurrency(normalizedAmount)}.
        </p>
        {href ? (
          <Button asChild variant="outline">
            <a href={href} onClick={onNavigate}>
              {ctaLabel}
            </a>
          </Button>
        ) : (
          <Button type="button" variant="outline" disabled>
            Inserisci un importo valido
          </Button>
        )}
      </div>
    </div>
  );
};
