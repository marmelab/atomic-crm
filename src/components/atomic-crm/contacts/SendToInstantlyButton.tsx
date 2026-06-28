import { Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  useDataProvider,
  useGetIdentity,
  useGetMany,
  useListContext,
  useNotify,
  useRefresh,
  useTranslate,
} from "ra-core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { CrmDataProvider } from "../providers/types";
import type { Contact, InstantlyCampaign } from "../types";

type IdentityWithRole = {
  role?: string;
};

export function SendToInstantlyButton() {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();
  const { onUnselectItems, selectedIds = [] } = useListContext<Contact>();
  const [open, setOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<InstantlyCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPushing, setIsPushing] = useState(false);

  const { data: selectedContacts = [] } = useGetMany<Contact>(
    "contacts",
    { ids: selectedIds },
    { enabled: open && selectedIds.length > 0 },
  );

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    dataProvider
      .listInstantlyCampaigns()
      .then(setCampaigns)
      .catch((error) => {
        notify("resources.contacts.send_to_instantly.load_error", {
          type: "error",
          messageArgs: { _: "Could not load Instantly campaigns" },
        });
        console.error("listInstantlyCampaigns failed:", error);
        setOpen(false);
      })
      .finally(() => setIsLoading(false));
  }, [open, dataProvider, notify]);

  const pushToCampaign = useCallback(
    async (campaign: InstantlyCampaign) => {
      setIsPushing(true);
      try {
        const pushed = await dataProvider.pushToInstantly(
          campaign.id,
          campaign.name,
          selectedContacts,
        );
        notify("resources.contacts.send_to_instantly.success", {
          type: "success",
          messageArgs: {
            _: "Pushed to Instantly",
            smart_count: pushed,
            campaign: campaign.name,
          },
        });
        setOpen(false);
        onUnselectItems();
        refresh();
      } catch (error) {
        notify("resources.contacts.send_to_instantly.error", {
          type: "error",
          messageArgs: { _: "Failed to push to Instantly" },
        });
        console.error("pushToInstantly failed:", error);
      } finally {
        setIsPushing(false);
      }
    },
    [dataProvider, selectedContacts, notify, onUnselectItems, refresh],
  );

  const role = (identity as IdentityWithRole | undefined)?.role;

  if (!selectedIds.length || (role !== "admin" && role !== "sales_manager")) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9"
        onClick={() => setOpen(true)}
      >
        <Send />
        {translate("resources.contacts.send_to_instantly.action", {
          _: "Send to Instantly",
        })}
      </Button>

      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && setOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {translate("resources.contacts.send_to_instantly.title", {
                _: "Send to Instantly campaign",
              })}
            </DialogTitle>
            <DialogDescription>
              {translate("resources.contacts.send_to_instantly.description", {
                _: "Pick a campaign to add the selected contacts to.",
                smart_count: selectedIds.length,
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col space-y-2 items-stretch">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">
                {translate("crm.common.loading", { _: "Loading…" })}
              </p>
            ) : campaigns.length > 0 ? (
              campaigns.map((campaign) => (
                <Button
                  key={campaign.id}
                  type="button"
                  variant="outline"
                  disabled={isPushing}
                  className="justify-start"
                  onClick={() => pushToCampaign(campaign)}
                >
                  {campaign.name}
                </Button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                {translate("resources.contacts.send_to_instantly.empty", {
                  _: "No campaigns found in Instantly.",
                })}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
