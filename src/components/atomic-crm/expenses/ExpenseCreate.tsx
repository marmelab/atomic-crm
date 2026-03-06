import { CreateBase, Form } from "ra-core";
import { useMemo } from "react";
import { useLocation } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

import { ExpenseInputs } from "./ExpenseInputs";
import {
  getExpenseCreateDefaultsFromSearch,
  getUnifiedAiExpenseBannerCopy,
} from "./expenseLinking";
import { FormToolbar } from "../layout/FormToolbar";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { MobileBackButton } from "../misc/MobileBackButton";

export const ExpenseCreate = () => {
  const { operationalConfig } = useConfigurationContext();
  const location = useLocation();
  const launcherDefaults = useMemo(
    () => getExpenseCreateDefaultsFromSearch(location.search),
    [location.search],
  );
  const launcherBanner = useMemo(
    () => getUnifiedAiExpenseBannerCopy(location.search),
    [location.search],
  );
  const defaultValues = useMemo(
    () => ({
      km_distance: 0,
      km_rate: operationalConfig.defaultKmRate,
      amount: 0,
      markup_percent: 0,
      ...launcherDefaults,
    }),
    [launcherDefaults, operationalConfig.defaultKmRate],
  );
  const isMobile = useIsMobile();

  return (
    <CreateBase redirect="show">
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
                <ExpenseInputs />
                <FormToolbar />
              </CardContent>
            </Card>
          </Form>
        </div>
      </div>
    </CreateBase>
  );
};
