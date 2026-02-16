import { useGetList } from "ra-core";
import { matchPath, useLocation, Link } from "react-router";
import type { ReactNode } from "react";
import { CreateButton } from "@/components/admin/create-button";
import { Progress } from "@/components/ui/progress";

import useAppBarHeight from "../misc/useAppBarHeight";
import type { Contact } from "../types";
import { DealCreate } from "./DealCreate";

export const DealEmpty = ({ children }: { children?: ReactNode }) => {
  const location = useLocation();
  const matchCreate = matchPath("/deals/create", location.pathname);
  const appbarHeight = useAppBarHeight();

  // get Contact data
  const { data: contacts, isPending: contactsLoading } = useGetList<Contact>(
    "contacts",
    {
      pagination: { page: 1, perPage: 1 },
    },
  );

  if (contactsLoading) return <Progress value={50} />;

  return (
    <div
      className="flex flex-col justify-center items-center gap-12"
      style={{
        height: `calc(100dvh - ${appbarHeight}px)`,
      }}
    >
      <img src="./img/empty.svg" alt="No deals found" className="w-48 h-48" />
      {contacts && contacts.length > 0 ? (
        <>
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-xl font-bold">No deals found</h2>
            <p className="text-sm text-center text-muted-foreground">
              It seems your deal list is empty.
            </p>
            <p className="text-sm text-center text-muted-foreground mb-2">
              Create your first deal to start tracking your sales pipeline.
            </p>
          </div>
          <div className="flex space-x-8">
            <CreateButton label="Create deal" />
          </div>
          <DealCreate open={!!matchCreate} />
          {children}
        </>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-xl font-bold">No deals found</h2>
          <p className="text-sm text-center text-muted-foreground">
            It seems your contact list is empty.
          </p>
          <p className="text-sm text-center text-muted-foreground mb-2">
            <Link to="/contacts/create" className="hover:underline font-medium">
              Add your first contact
            </Link>{" "}
            before creating a deal.
          </p>
        </div>
      )}
    </div>
  );
};
