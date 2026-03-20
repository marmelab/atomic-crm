import { useGetList } from "ra-core";
import { matchPath, useLocation, Link, useNavigate } from "react-router";
import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import useAppBarHeight from "../misc/useAppBarHeight";
import type { Contact } from "../types";
import { DealCreate } from "./DealCreate";

export const DealEmpty = ({ children }: { children?: ReactNode }) => {
  const location = useLocation();
  const matchCreate = matchPath("/deals/create", location.pathname);
  const matchViewCreate = matchPath("/views/:viewId/create", location.pathname);
  const viewId = matchViewCreate?.params.viewId;
  const navigate = useNavigate();
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
      <img src="./img/empty.svg" alt="Aucune opportunité" />
      {contacts && contacts.length > 0 ? (
        <>
          <div className="flex flex-col items-center gap-0">
            <h3 className="text-lg font-bold">No deals found</h3>
            <p className="text-sm text-center text-muted-foreground mb-4">
              It seems your deal list is empty.
            </p>
          </div>
          <div className="flex space-x-8">
            <button
              className={buttonVariants({ variant: "outline" })}
              onClick={() =>
                navigate(viewId ? `/views/${viewId}/create` : "/deals/create")
              }
            >
              <Plus />
              Créer une opportunité
            </button>
          </div>
          <DealCreate open={!!matchCreate || !!matchViewCreate} />
          {children}
        </>
      ) : (
        <div className="flex flex-col items-center gap-0">
          <h3 className="text-lg font-bold">No deals found</h3>
          <p className="text-sm text-center text-muted-foreground mb-4">
            It seems your contact list is empty.
            <br />
            <Link to="/contacts/create" className="hover:underline">
              Add your first contact
            </Link>{" "}
            before creating a deal.
          </p>
        </div>
      )}
    </div>
  );
};
