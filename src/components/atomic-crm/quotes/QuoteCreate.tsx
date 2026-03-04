import { useQueryClient } from "@tanstack/react-query";
import {
  Form,
  useDataProvider,
  useListContext,
  useRedirect,
  type GetListResult,
} from "ra-core";
import { Create } from "@/components/admin/create";
import { SaveButton } from "@/components/admin/form";
import { FormToolbar } from "@/components/admin/simple-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

import type { Quote } from "../types";
import { QuoteInputs } from "./QuoteInputs";
import { transformQuoteFormData } from "./quoteItems";

export const QuoteCreate = ({ open }: { open: boolean }) => {
  const redirect = useRedirect();
  const dataProvider = useDataProvider();
  const { data: allQuotes } = useListContext<Quote>();

  const handleClose = () => {
    redirect("/quotes");
  };

  const queryClient = useQueryClient();

  const onSuccess = async (quote: Quote) => {
    if (!allQuotes) {
      redirect("/quotes");
      return;
    }
    // increase the index of all quotes in the same status as the new quote
    const quotes = allQuotes.filter(
      (q: Quote) => q.status === quote.status && q.id !== quote.id,
    );
    await Promise.all(
      quotes.map(async (oldQuote) =>
        dataProvider.update("quotes", {
          id: oldQuote.id,
          data: { index: oldQuote.index + 1 },
          previousData: oldQuote,
        }),
      ),
    );
    const quotesById = quotes.reduce(
      (acc, q) => ({
        ...acc,
        [q.id]: { ...q, index: q.index + 1 },
      }),
      {} as { [key: string]: Quote },
    );
    const now = Date.now();
    queryClient.setQueriesData<GetListResult | undefined>(
      { queryKey: ["quotes", "getList"] },
      (res) => {
        if (!res) return res;
        return {
          ...res,
          data: res.data.map((q: Quote) => quotesById[q.id] || q),
        };
      },
      { updatedAt: now },
    );
    redirect("/quotes");
  };

  return (
    <Dialog open={open} onOpenChange={() => handleClose()}>
      <DialogContent className="lg:max-w-4xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
        <DialogTitle>Nuovo preventivo</DialogTitle>
        <DialogDescription className="sr-only">
          Compila i campi per creare un nuovo preventivo
        </DialogDescription>
        <Create
          resource="quotes"
          mutationOptions={{ onSuccess }}
          transform={transformQuoteFormData}
        >
          <Form
            defaultValues={{
              index: 0,
              status: "primo_contatto",
              all_day: true,
              quote_items: [],
              is_taxable: true,
            }}
          >
            <QuoteInputs />
            <FormToolbar>
              <SaveButton />
            </FormToolbar>
          </Form>
        </Create>
      </DialogContent>
    </Dialog>
  );
};
