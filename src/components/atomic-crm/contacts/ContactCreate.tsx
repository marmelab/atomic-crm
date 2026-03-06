import {
  CreateBase,
  Form,
  useDataProvider,
  useNotify,
  useRedirect,
} from "ra-core";
import { useMemo } from "react";
import { useLocation } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

import { ContactInputs } from "./ContactInputs";
import {
  getContactCreateDefaultsFromSearch,
  getContactCreateLinkContextFromSearch,
} from "./contactLinking";
import { FormToolbar } from "../layout/FormToolbar";
import { MobileBackButton } from "../misc/MobileBackButton";
import type { CrmDataProvider } from "../providers/types";

const getLauncherBannerCopy = (search: string) => {
  const handoff = getContactCreateLinkContextFromSearch(search);

  if (!handoff) {
    return null;
  }

  if (handoff.action === "project_add_contact") {
    return "Aperto da un progetto: salva il referente e verra' collegato automaticamente al progetto corrente.";
  }

  return "Aperto da un cliente: salva il referente e restera' collegato a questo cliente.";
};

export const ContactCreate = () => {
  const location = useLocation();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const redirect = useRedirect();
  const notify = useNotify();
  const defaultValues = useMemo(
    () => getContactCreateDefaultsFromSearch(location.search),
    [location.search],
  );
  const launcherBanner = useMemo(
    () => getLauncherBannerCopy(location.search),
    [location.search],
  );
  const linkContext = useMemo(
    () => getContactCreateLinkContextFromSearch(location.search),
    [location.search],
  );
  const isMobile = useIsMobile();

  return (
    <CreateBase
      redirect={false}
      mutationOptions={{
        onSuccess: async (data) => {
          if (linkContext?.projectId) {
            await dataProvider.create("project_contacts", {
              data: {
                project_id: linkContext.projectId,
                contact_id: data.id,
                is_primary: data.is_primary_for_client === true,
              },
            });
          }

          notify("Referente creato", { type: "success" });
          redirect("show", "contacts", data.id, data);
        },
      }}
    >
      <div className="mt-4 mb-28 md:mb-2 flex flex-col px-4 md:px-0">
        <div className="flex-1">
          <Form defaultValues={defaultValues}>
            {isMobile && (
              <div className="mb-3">
                <MobileBackButton />
              </div>
            )}
            {launcherBanner ? (
              <div className="mb-3 rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                {launcherBanner}
              </div>
            ) : null}
            <Card>
              <CardContent>
                <ContactInputs />
                <FormToolbar />
              </CardContent>
            </Card>
          </Form>
        </div>
      </div>
    </CreateBase>
  );
};
