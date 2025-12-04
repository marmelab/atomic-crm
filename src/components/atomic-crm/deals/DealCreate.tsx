import { useQueryClient } from "@tanstack/react-query";
import {
  Form,
  useDataProvider,
  useGetIdentity,
  useListContext,
  useRedirect,
  type GetListResult,
} from "ra-core";
import { Create, type CreateProps } from "@/components/admin/create";
import { SaveButton } from "@/components/admin/form";
import { FormToolbar } from "@/components/admin/simple-form";
import { Dialog, DialogContent } from "@/components/ui/dialog";

import type { Deal } from "../types";
import { DealInputs } from "./DealInputs";

export const DealCreate = ({ open }: { open: boolean }) => {
  const dataProvider = useDataProvider();
  const redirect = useRedirect();
  const { data: allDeals } = useListContext<Deal>();
  const queryClient = useQueryClient();

  const onSuccess = async (deal: Deal) => {
    if (!allDeals) {
      redirect("/deals");
      return;
    }
    // increase the index of all deals in the same stage as the new deal
    // first, get the list of deals in the same stage
    const deals = allDeals.filter(
      (d: Deal) => d.stage === deal.stage && d.id !== deal.id,
    );
    // update the actual deals in the database
    await Promise.all(
      deals.map(async (oldDeal) =>
        dataProvider.update("deals", {
          id: oldDeal.id,
          data: { index: oldDeal.index + 1 },
          previousData: oldDeal,
        }),
      ),
    );
    // refresh the list of deals in the cache as we used dataProvider.update(),
    // which does not update the cache
    const dealsById = deals.reduce(
      (acc, d) => ({
        ...acc,
        [d.id]: { ...d, index: d.index + 1 },
      }),
      {} as { [key: string]: Deal },
    );
    const now = Date.now();
    queryClient.setQueriesData<GetListResult | undefined>(
      { queryKey: ["deals", "getList"] },
      (res) => {
        if (!res) return res;
        return {
          ...res,
          data: res.data.map((d: Deal) => dealsById[d.id] || d),
        };
      },
      { updatedAt: now },
    );
    redirect("/deals");
  };

  const handleClose = () => {
    redirect("/deals");
  };

  return (
    <Dialog open={open} onOpenChange={() => handleClose()}>
      <DialogContent className="lg:max-w-4xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
        <DealCreatePage mutationOptions={{ onSuccess }} />
      </DialogContent>
    </Dialog>
  );
};

export const DealCreatePage = (props: Partial<CreateProps>) => {
  const { identity } = useGetIdentity();
  return (
    <div className="p-2 md:p-0">
      <Create resource="deals" redirect="list" {...props}>
        <Form
          defaultValues={{
            sales_id: identity?.id,
            contact_ids: [],
            index: 0,
          }}
        >
          <DealInputs />
          <FormToolbar>
            <div className="flex md:block justify-end">
              <SaveButton />
            </div>
          </FormToolbar>
        </Form>
      </Create>
    </div>
  );
};
