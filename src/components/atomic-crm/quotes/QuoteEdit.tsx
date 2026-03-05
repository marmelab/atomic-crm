import { Eye, EyeOff } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import {
  EditBase,
  Form,
  useNotify,
  useRecordContext,
  useRedirect,
} from "ra-core";
import { Link } from "react-router";
import { DeleteButton } from "@/components/admin/delete-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

import { FormToolbar } from "../layout/FormToolbar";
import type { Quote } from "../types";
import { QuoteInputs } from "./QuoteInputs";
import { transformQuoteFormData } from "./quoteItems";

const QuotePDFPreview = lazy(() =>
  import("./QuotePDFPreview").then((m) => ({ default: m.QuotePDFPreview })),
);

export const QuoteEdit = ({ open, id }: { open: boolean; id?: string }) => {
  const redirect = useRedirect();
  const notify = useNotify();
  const [showPreview, setShowPreview] = useState(false);

  const handleClose = () => {
    redirect("/quotes", undefined, undefined, undefined, {
      _scrollToTop: false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={() => handleClose()}>
      <DialogContent
        className={`${showPreview ? "lg:max-w-7xl" : "lg:max-w-4xl"} p-4 overflow-y-auto max-h-9/10 top-1/20 translate-y-0`}
      >
        <DialogDescription className="sr-only">
          Modifica i campi del preventivo
        </DialogDescription>
        {id ? (
          <EditBase
            id={id}
            transform={transformQuoteFormData}
            mutationMode="pessimistic"
            mutationOptions={{
              onSuccess: () => {
                notify("Preventivo aggiornato");
                redirect(
                  `/quotes/${id}/show`,
                  undefined,
                  undefined,
                  undefined,
                  { _scrollToTop: false },
                );
              },
            }}
          >
            <EditHeader
              showPreview={showPreview}
              onTogglePreview={() => setShowPreview((v) => !v)}
            />
            <Form>
              <div className={showPreview ? "flex gap-6" : ""}>
                <div className={showPreview ? "w-[55%]" : ""}>
                  <QuoteInputs />
                </div>
                {showPreview && (
                  <div className="w-[45%]">
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
              <FormToolbar />
            </Form>
          </EditBase>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

function EditHeader({
  showPreview,
  onTogglePreview,
}: {
  showPreview: boolean;
  onTogglePreview: () => void;
}) {
  const quote = useRecordContext<Quote>();
  if (!quote) return null;

  return (
    <DialogTitle className="pb-0">
      <div className="flex justify-between items-start mb-8">
        <h2 className="text-2xl font-semibold">Modifica preventivo</h2>
        <div className="flex gap-2 pr-12">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onTogglePreview}
          >
            {showPreview ? (
              <EyeOff className="h-4 w-4 mr-1" />
            ) : (
              <Eye className="h-4 w-4 mr-1" />
            )}
            {showPreview ? "Nascondi" : "Anteprima"}
          </Button>
          <DeleteButton />
          <Button asChild variant="outline" className="h-9">
            <Link to={`/quotes/${quote.id}/show`}>Torna al preventivo</Link>
          </Button>
        </div>
      </div>
    </DialogTitle>
  );
}
