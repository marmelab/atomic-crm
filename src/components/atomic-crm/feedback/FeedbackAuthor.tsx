import { type Identifier, useGetManyAggregate } from "ra-core";

import {
  AvatarFallback,
  AvatarImage,
  Avatar as ShadcnAvatar,
} from "@/components/ui/avatar";

type Sale = {
  id: Identifier;
  first_name?: string;
  last_name?: string;
  avatar?: { src?: string | null } | null;
};

/**
 * Visar avatar + namn för den som skrev en feedback-post.
 * Återanvänder samma sales-uppslag som useGetSalesName (useGetManyAggregate)
 * så uppslagen batchas/cachas av react-query.
 */
export const FeedbackAuthor = ({
  salesId,
  isCurrentUser,
}: {
  salesId?: Identifier;
  isCurrentUser: boolean;
}) => {
  const { data } = useGetManyAggregate<Sale>(
    "sales",
    { ids: salesId != null ? [salesId] : [] },
    { enabled: salesId != null },
  );
  const sale = data?.[0];

  const first = sale?.first_name ?? "";
  const last = sale?.last_name ?? "";
  const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "?";
  const name = isCurrentUser ? "Du" : `${first} ${last}`.trim() || "Okänd";

  return (
    <div className="flex items-center gap-1.5">
      <ShadcnAvatar className="h-5 w-5">
        <AvatarImage src={sale?.avatar?.src ?? undefined} />
        <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
      </ShadcnAvatar>
      <span className="text-xs font-medium text-foreground">{name}</span>
    </div>
  );
};
