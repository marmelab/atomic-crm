import { useRecordContext } from "ra-core";

import { Avatar } from "../contacts/Avatar";
import type { Contact } from "../types";
import { usePersonContextLabels } from "./usePersonContextLabels";

// Search-result row for the Opportunity "Person" field: name, email, and an
// optional small context label ("Past GYU client", "Active opportunity")
// so a returning client is recognizable before selection (see §2 of the
// Programs + Opportunity UX slice report).
// eslint-disable-next-line react-refresh/only-export-components
const PersonOptionRender = () => {
  const record: Contact | undefined = useRecordContext();
  const getContextLabel = usePersonContextLabels();
  if (!record) return null;

  const email = record.email_jsonb?.find((entry) => entry.email)?.email;
  const contextLabel = getContextLabel(record.id);

  return (
    <div className="flex flex-row gap-3 items-center justify-start whitespace-normal text-left">
      <Avatar height={40} width={40} record={record} />
      <div className="flex flex-col items-start gap-0.5 min-w-0">
        <span>
          {record.first_name} {record.last_name}
        </span>
        {(email || contextLabel) && (
          <span className="text-xs text-muted-foreground truncate">
            {[email, contextLabel].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>
    </div>
  );
};

export const personOptionText = <PersonOptionRender />;
