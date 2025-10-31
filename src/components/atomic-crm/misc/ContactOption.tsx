import { useRecordContext } from "ra-core";

import { Avatar } from "../contacts/Avatar";
import type { Contact } from "../types";

// eslint-disable-next-line react-refresh/only-export-components
const ContactOptionRender = () => {
  const record: Contact | undefined = useRecordContext();
  if (!record) return null;
  return (
    <div className="flex flex-row gap-4 items-center justify-start">
      <Avatar height={40} width={40} record={record} />
      <div className="flex flex-col items-start gap-1">
        <span>
          {record.first_name} {record.last_name}
        </span>
        <span className="text-xs text-muted-foreground">
          {record.title}
          {record.title && record.company_name && " at "}
          {record.company_name}
        </span>
      </div>
    </div>
  );
};
export const contactOptionText = <ContactOptionRender />;
