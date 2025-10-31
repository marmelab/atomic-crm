import { DollarSign } from "lucide-react";
import { Link } from "react-router";
import { useCreatePath, useListContext, useRecordContext } from "ra-core";
import { ReferenceManyField } from "@/components/admin";
import { Card } from "@/components/ui/card";

import { Avatar as ContactAvatar } from "../contacts/Avatar";
import type { Company } from "../types";
import { CompanyAvatar } from "./CompanyAvatar";

export const CompanyCard = (props: { record?: Company }) => {
  const createPath = useCreatePath();
  const record = useRecordContext<Company>(props);
  if (!record) return null;

  return (
    <Link
      to={createPath({
        resource: "companies",
        id: record.id,
        type: "show",
      })}
      className="no-underline"
    >
      <Card className="h-[200px] flex flex-col justify-between p-4 hover:bg-muted">
        <div className="flex flex-col items-center gap-1">
          <CompanyAvatar />
          <div className="text-center mt-1">
            <h6 className="text-sm font-medium">{record.name}</h6>
            <p className="text-xs text-muted-foreground">{record.sector}</p>
          </div>
        </div>
        <div className="flex flex-row w-full justify-between gap-2">
          <div className="flex items-center">
            {record.nb_contacts ? (
              <ReferenceManyField reference="contacts" target="company_id">
                <AvatarGroupIterator />
              </ReferenceManyField>
            ) : null}
          </div>
          {record.nb_deals ? (
            <div className="flex items-center ml-2 gap-0.5">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{record.nb_deals}</span>
              <span className="text-xs text-muted-foreground">
                {record.nb_deals
                  ? record.nb_deals > 1
                    ? "deals"
                    : "deal"
                  : "deal"}
              </span>
            </div>
          ) : null}
        </div>
      </Card>
    </Link>
  );
};

const AvatarGroupIterator = () => {
  const { data, total, error, isPending } = useListContext();
  if (isPending || error) return null;

  const MAX_AVATARS = 3;
  return (
    <div className="*:data-[slot=avatar]:ring-background flex -space-x-0.5 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:grayscale">
      {data.slice(0, MAX_AVATARS).map((record: any) => (
        <ContactAvatar
          key={record.id}
          record={record}
          width={25}
          height={25}
          title={`${record.first_name} ${record.last_name}`}
        />
      ))}
      {total > MAX_AVATARS && (
        <span
          className="relative flex size-8 shrink-0 overflow-hidden rounded-full w-[25px] h-[25px]"
          data-slot="avatar"
        >
          <span className="bg-muted flex size-full items-center justify-center rounded-full text-[10px]">
            +{total - MAX_AVATARS}
          </span>
        </span>
      )}
    </div>
  );
};
