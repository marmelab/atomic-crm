import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, X } from "lucide-react";
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
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();

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
        className={`${showPreview && !isMobile ? "lg:max-w-7xl" : "lg:max-w-4xl"} max-h-9/10 top-1/20 translate-y-0 ${showPreview && !isMobile ? "overflow-hidden" : "overflow-y-auto"}`}
      >
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
            {showPreview && !isMobile ? (
              <div className="flex gap-6 h-[calc(90vh-10rem)]">
                <div className="w-[55%] overflow-y-auto pr-2">
                  <QuoteInputs />
                  <FormToolbar>
                    <div className="flex justify-between items-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950"
                        onClick={() => setShowPreview(false)}
                      >
                        <EyeOff className="h-4 w-4 mr-1" />
                        Nascondi anteprima
                      </Button>
                      <SaveButton />
                    </div>
                  </FormToolbar>
                </div>
                <div className="w-[45%] h-full">
                  <Suspense
                    fallback={
                      <div className="h-full rounded-md border bg-muted/30 flex items-center justify-center text-muted-foreground text-sm">
                        Caricamento anteprima...
                      </div>
                    }
                  >
                    <QuotePDFPreview />
                  </Suspense>
                </div>
              </div>
            ) : (
              <>
                <QuoteInputs />
                <FormToolbar>
                  <div className="flex justify-between items-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950"
                      onClick={() => setShowPreview((v) => !v)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Anteprima
                    </Button>
                    <SaveButton />
                  </div>
                </FormToolbar>
              </>
            )}
            {showPreview && isMobile && (
              <div className="fixed inset-0 z-50 bg-background flex flex-col">
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="font-semibold">Anteprima preventivo</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowPreview(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <div className="flex-1 min-h-0 p-4">
                  <Suspense
                    fallback={
                      <div className="h-full rounded-md border bg-muted/30 flex items-center justify-center text-muted-foreground text-sm">
                        Caricamento anteprima...
                      </div>
                    }
                  >
                    <QuotePDFPreview />
                  </Suspense>
                </div>
              </div>
            )}
          </Form>
        </Create>
      </DialogContent>
    </Dialog>
  );
};
