import { useQuery } from "@tanstack/react-query";
import { useDataProvider, useRecordContext } from "ra-core";
import { Mail, ExternalLink, Loader2 } from "lucide-react";
import type { CrmDataProvider } from "../providers/types";
import type { Contact } from "../types";
import type { GoogleEmailMessage } from "../google/types";

export const ContactEmailHistory = () => {
  const record = useRecordContext<Contact>();
  const dataProvider = useDataProvider<CrmDataProvider>();

  const emails =
    record?.email_jsonb
      ?.map((e) => e.email)
      .filter((e): e is string => !!e) ?? [];

  const { data, isPending, error } = useQuery({
    queryKey: ["google-emails", record?.id],
    queryFn: () => dataProvider.getContactEmails(emails, 10),
    enabled: emails.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (!emails.length) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        Aucun email renseigné
      </p>
    );
  }

  if (error) return null;

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.messages?.length) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        Aucun email trouvé
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {data.messages.map((message) => (
        <EmailItem key={message.id} message={message} />
      ))}
      {data.totalEstimate > 10 && (
        <p className="text-xs text-muted-foreground pt-1">
          +{data.totalEstimate - 10} autres emails
        </p>
      )}
    </div>
  );
};

const EmailItem = ({ message }: { message: GoogleEmailMessage }) => {
  const date = message.date
    ? new Date(message.date)
    : message.internalDate
      ? new Date(Number(message.internalDate))
      : null;

  const formattedDate = date
    ? date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "";

  // Extract just the name from "Name <email>" format
  const fromName = message.from
    .replace(/<[^>]+>/, "")
    .trim()
    .replace(/^"(.*)"$/, "$1");

  return (
    <a
      href={`https://mail.google.com/mail/u/0/#inbox/${message.threadId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-2 p-1.5 rounded-md hover:bg-muted/50 transition-colors group"
    >
      <Mail className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium truncate">
            {message.subject || "(sans objet)"}
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {formattedDate}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground truncate">
          {fromName}
        </div>
        <div className="text-[10px] text-muted-foreground truncate mt-0.5">
          {message.snippet}
        </div>
      </div>
      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 mt-1" />
    </a>
  );
};
