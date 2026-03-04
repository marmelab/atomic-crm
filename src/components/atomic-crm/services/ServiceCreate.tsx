import { CreateBase, Form } from "ra-core";
import { useMemo } from "react";
import { useLocation } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

import { ServiceInputs } from "./ServiceInputs";
import {
  getServiceCreateDefaultsFromSearch,
  getUnifiedAiServiceBannerCopy,
} from "./serviceLinking";
import { FormToolbar } from "../layout/FormToolbar";
import { MobileBackButton } from "../misc/MobileBackButton";
import { useConfigurationContext } from "../root/ConfigurationContext";

export const ServiceCreate = () => {
  const { operationalConfig } = useConfigurationContext();
  const location = useLocation();
  const launcherDefaults = useMemo(
    () => getServiceCreateDefaultsFromSearch(location.search),
    [location.search],
  );
  const launcherBanner = useMemo(
    () => getUnifiedAiServiceBannerCopy(location.search),
    [location.search],
  );
  const isMobile = useIsMobile();

  return (
    <CreateBase redirect="show">
      <div className="mt-4 flex px-4 md:px-0">
        <div className="flex-1">
          <Form
            defaultValues={{
              all_day: true,
              is_taxable: true,
              fee_shooting: 0,
              fee_editing: 0,
              fee_other: 0,
              discount: 0,
              km_distance: 0,
              km_rate: operationalConfig.defaultKmRate,
              ...launcherDefaults,
            }}
          >
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
            <Card className="max-w-full overflow-hidden">
              <CardContent>
                <ServiceInputs />
                <FormToolbar />
              </CardContent>
            </Card>
          </Form>
        </div>
      </div>
    </CreateBase>
  );
};
