import { useListContext } from "ra-core";
import { Link as RouterLink } from "react-router";
import { Avatar } from "../contacts/Avatar";

export const ContactList = () => {
  const { data, error, isPending } = useListContext();
  if (isPending || error) return <div className="h-8" />;
  return (
    <div className="flex flex-row flex-wrap gap-4 mt-4">
      {data.map((contact) => (
        <div className="flex flex-row gap-4 items-center" key={contact.id}>
          <Avatar record={contact} />
          <div className="flex flex-col">
            <RouterLink
              to={`/contacts/${contact.id}/show`}
              className="text-sm hover:underline"
            >
              {contact.first_name} {contact.last_name}
            </RouterLink>
            <span className="text-xs text-muted-foreground">
              {contact.title}
              {contact.title && contact.company_name && " at "}
              {contact.company_name}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
