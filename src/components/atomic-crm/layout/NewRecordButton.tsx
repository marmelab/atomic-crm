import { Building2, Handshake, Plus, UsersRound } from "lucide-react";
import { useTranslate } from "ra-core";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NEW_RECORD_ITEMS = [
  { resource: "contacts", icon: UsersRound },
  { resource: "companies", icon: Building2 },
  { resource: "deals", icon: Handshake },
] as const;

/** Desktop app bar shortcut to the create form of each main resource. */
export const NewRecordButton = () => {
  const translate = useTranslate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Plus />
        {translate("crm.header.new")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {NEW_RECORD_ITEMS.map(({ resource, icon: Icon }) => (
          <DropdownMenuItem
            key={resource}
            render={
              <Link
                to={`/${resource}/create`}
                className="flex items-center gap-2"
              />
            }
          >
            <Icon />
            {translate(`resources.${resource}.name`, { smart_count: 1 })}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
