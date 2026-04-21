import { useMemo, useState } from "react";
import { useGetMany, useNotify, useRecordContext } from "ra-core";
import { ExternalLink, FileText, RotateCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Contact, Deal } from "../types";
import {
  GenerateProposalError,
  useGenerateProposal,
} from "./useGenerateProposal";

const ERROR_MESSAGES: Record<string, string> = {
  nosho_api_key_invalid: "Clé API invalide. Contactez l'administrateur.",
  nosho_timeout: "Le service est indisponible, réessayez plus tard.",
  nosho_unreachable: "Le service est indisponible, réessayez plus tard.",
  nosho_error: "Le service a renvoyé une erreur. Réessayez plus tard.",
  nosho_invalid_response: "Réponse inattendue du service. Réessayez.",
  contact_not_in_deal: "Ce contact n'est pas lié à l'opportunité.",
  deal_has_no_company: "Cette opportunité n'est liée à aucune société.",
  deal_not_found: "Opportunité introuvable.",
  company_not_found: "Société introuvable.",
  invalid_deal_id: "Opportunité invalide.",
  invalid_json: "Requête invalide.",
  internal_error: "Erreur interne. Réessayez plus tard.",
};

function errorToMessage(err: GenerateProposalError): string {
  if (err.code === "invalid_payload") {
    const first = err.issues[0]?.message;
    return first ? `Données invalides : ${first}` : "Données invalides.";
  }
  return (
    ERROR_MESSAGES[err.code] ??
    "Impossible de générer la proposition. Réessayez."
  );
}

export const GenerateProposalAction = () => {
  const record = useRecordContext<Deal>();
  if (!record) return null;
  if (record.proposal_public_url) {
    return <ProposalUrlsDisplay deal={record} />;
  }
  return <GenerateProposalTrigger deal={record} />;
};

const GenerateProposalTrigger = ({ deal }: { deal: Deal }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        variant="outline"
        className="flex items-center gap-2 h-9"
      >
        <FileText className="w-4 h-4" />
        Générer proposition
      </Button>
      {open && (
        <GenerateProposalDialog
          deal={deal}
          force={false}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

const ProposalUrlsDisplay = ({ deal }: { deal: Deal }) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Badge variant="secondary">Proposition</Badge>
      <Button size="sm" variant="outline" className="h-9" asChild>
        <a
          href={deal.proposal_edit_url ?? "#"}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink className="w-4 h-4 mr-1" />
          Édition
        </a>
      </Button>
      <Button size="sm" variant="outline" className="h-9" asChild>
        <a
          href={deal.proposal_public_url ?? "#"}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink className="w-4 h-4 mr-1" />
          Version client
        </a>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-9"
        onClick={() => setConfirmOpen(true)}
        aria-label="Régénérer la proposition"
      >
        <RotateCw className="w-4 h-4" />
      </Button>
      {confirmOpen && (
        <RegenerateConfirmDialog
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            setRegenOpen(true);
          }}
        />
      )}
      {regenOpen && (
        <GenerateProposalDialog
          deal={deal}
          force={true}
          onClose={() => setRegenOpen(false)}
        />
      )}
    </div>
  );
};

const GenerateProposalDialog = ({
  deal,
  force,
  onClose,
}: {
  deal: Deal;
  force: boolean;
  onClose: () => void;
}) => {
  const contactIds = useMemo(
    () => (Array.isArray(deal.contact_ids) ? deal.contact_ids : []),
    [deal.contact_ids],
  );
  const { data: contacts } = useGetMany<Contact>(
    "contacts",
    { ids: contactIds },
    { enabled: contactIds.length > 0 },
  );
  const [selectedContactId, setSelectedContactId] = useState<string>(
    contactIds[0] !== undefined ? String(contactIds[0]) : "",
  );
  const mutation = useGenerateProposal();
  const notify = useNotify();

  const handleSubmit = async () => {
    try {
      await mutation.mutateAsync({
        dealId: Number(deal.id),
        contactId: selectedContactId ? Number(selectedContactId) : null,
        force,
      });
      notify("Proposition générée", { type: "success" });
      onClose();
    } catch (e) {
      const msg =
        e instanceof GenerateProposalError
          ? errorToMessage(e)
          : "Impossible de générer la proposition. Réessayez.";
      notify(msg, { type: "error" });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {force
              ? "Régénérer la proposition"
              : "Générer une proposition commerciale"}
          </DialogTitle>
          {contactIds.length === 0 && (
            <DialogDescription>
              Aucun contact lié à l'opportunité. Le document sera généré sans
              nom de contact.
            </DialogDescription>
          )}
        </DialogHeader>
        {contactIds.length > 0 && (
          <div className="py-2">
            <label className="text-sm font-medium mb-2 block">
              Contact destinataire
            </label>
            <Select
              value={selectedContactId}
              onValueChange={setSelectedContactId}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {contacts?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.first_name} {c.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? "Génération..." : "Générer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const RegenerateConfirmDialog = ({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) => (
  <Dialog open onOpenChange={(o) => !o && onCancel()}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Régénérer la proposition ?</DialogTitle>
        <DialogDescription>
          Les liens existants seront écrasés et ne seront plus accessibles.
          Cette action est irréversible.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button variant="destructive" onClick={onConfirm}>
          Régénérer
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
