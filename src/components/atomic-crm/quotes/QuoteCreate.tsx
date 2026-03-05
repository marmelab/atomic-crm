import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { lazy, Suspense, useState } from "react";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

import type { Quote } from "../types";
import { QuoteInputs } from "./QuoteInputs";
import { transformQuoteFormData } from "./quoteItems";

const QuotePDFPreview = lazy(() =>
  import("./QuotePDFPreview").then((m) => ({ default: m.QuotePDFPreview })),
);

export const QuoteCreate = ({ open }: { open: boolean }) => {
  const redirect = useRedirect();
  const dataProvider = useDataProvider();
  const { data: allQuotes } = useListContext<Quote>();
  const [showPreview, setShowPreview] = useState(false);

  const handleClose = () => {
    redirect("/quotes");
  };

  const queryClient = useQueryClient();

  const onSuccess = async (quote: Quote) => {
    if (!allQuotes) {
      redirect("/quotes");
      return;
    }
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
      <DialogContent
        className={`${showPreview ? "lg:max-w-7xl" : "lg:max-w-4xl"} overflow-y-auto max-h-9/10 top-1/20 translate-y-0`}
      >
        <DialogTitle>
          <div className="flex items-center justify-between pr-8">
            <span>Nuovo preventivo</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview((v) => !v)}
            >
              {showPreview ? (
                <EyeOff className="h-4 w-4 mr-1" />
              ) : (
                <Eye className="h-4 w-4 mr-1" />
              )}
              {showPreview ? "Nascondi anteprima" : "Anteprima"}
            </Button>
          </div>
        </DialogTitle>
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
            <div className={showPreview ? "flex gap-6" : ""}>
              <div className={showPreview ? "w-[55%]" : ""}>
                <QuoteInputs />
              </div>
              {showPreview && (
                <div className="w-[45%] sticky top-0 self-start">
                  <Suspense
                    fallback={
                      <div className="h-[500px] rounded-md border bg-muted/30 flex items-center justify-center text-muted-foreground text-sm">
                        Caricamento anteprima...
                      </div>
                    }
                  >
                    <QuotePDFPreview />
                  </Suspense>
                </div>
              )}
            </div>
            <FormToolbar>
              <SaveButton />
            </FormToolbar>
          </Form>
        </Create>
      </DialogContent>
    </Dialog>
  );
};
