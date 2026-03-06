import { ArrowLeft, Eye, EyeOff, X } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import {
  EditBase,
  Form,
  useNotify,
  useRecordContext,
  useRedirect,
} from "ra-core";
import { useNavigate } from "react-router";
import { CancelButton } from "@/components/admin/cancel-button";
import { DeleteButton } from "@/components/admin/delete-button";
import { SaveButton } from "@/components/admin/form";
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

export const QuoteEdit = ({ open, id }: { open: boolean; id?: string }) => {
  const redirect = useRedirect();
  const notify = useNotify();
  const [showPreview, setShowPreview] = useState(false);
  const isMobile = useIsMobile();

  const handleClose = () => {
    redirect("/quotes", undefined, undefined, undefined, {
      _scrollToTop: false,
    });
  };

  const desktopPreview = showPreview && !isMobile;

  return (
    <Dialog open={open} onOpenChange={() => handleClose()}>
      <DialogContent
        className={`${desktopPreview ? "lg:max-w-7xl" : "lg:max-w-4xl"} p-4 max-h-9/10 top-1/20 translate-y-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:top-0 max-sm:rounded-none max-sm:border-0 ${desktopPreview ? "overflow-hidden" : "overflow-y-auto"}`}
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
            <EditHeader />
            <Form>
              {desktopPreview ? (
                <div className="flex gap-6 h-[calc(90vh-10rem)]">
                  <div className="w-[55%] overflow-y-auto pr-2">
                    <QuoteInputs />
                    <div
                      role="toolbar"
                      className="sticky flex pt-4 bottom-0 bg-linear-to-b from-transparent to-card to-10% flex-row justify-between items-center"
                    >
                      <CancelButton />
                      <div className="flex gap-2">
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
                        <DeleteButton variant="outline" size="sm" />
                      </div>
                      <SaveButton />
                    </div>
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
                  {isMobile ? (
                    <MobileToolbar
                      showPreview={showPreview}
                      onTogglePreview={() => setShowPreview((v) => !v)}
                    />
                  ) : (
                    <div
                      role="toolbar"
                      className="sticky flex pt-4 bottom-0 bg-linear-to-b from-transparent to-card to-10% flex-row justify-between items-center"
                    >
                      <CancelButton />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950"
                          onClick={() => setShowPreview((v) => !v)}
                        >
                          {showPreview ? (
                            <EyeOff className="h-4 w-4 mr-1" />
                          ) : (
                            <Eye className="h-4 w-4 mr-1" />
                          )}
                          {showPreview ? "Nascondi anteprima" : "Anteprima"}
                        </Button>
                        <DeleteButton variant="outline" size="sm" />
                      </div>
                      <SaveButton />
                    </div>
                  )}
                </>
              )}
              {showPreview && isMobile && (
                <MobilePreviewOverlay onClose={() => setShowPreview(false)} />
              )}
            </Form>
          </EditBase>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

function MobilePreviewOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Anteprima preventivo</h3>
        <Button type="button" variant="ghost" size="icon" onClick={onClose}>
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
  );
}

function EditHeader() {
  const quote = useRecordContext<Quote>();
  if (!quote) return null;

  return (
    <DialogTitle className="pb-0">
      <div className="flex justify-between items-start mb-4 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-semibold">
          Modifica preventivo
        </h2>
      </div>
    </DialogTitle>
  );
}

function MobileToolbar({
  showPreview,
  onTogglePreview,
}: {
  showPreview: boolean;
  onTogglePreview: () => void;
}) {
  const navigate = useNavigate();
  return (
    <div
      role="toolbar"
      className="sticky flex py-3 bottom-0 bg-linear-to-b from-transparent to-card to-10% flex-row justify-between items-center gap-2"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="h-4 w-4" />
        Indietro
      </Button>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950"
          onClick={onTogglePreview}
        >
          {showPreview ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
        <DeleteButton
          variant="outline"
          size="icon"
          label=" "
          className="text-destructive! border-destructive! hover:bg-destructive/10!"
        />
      </div>
      <SaveButton />
    </div>
  );
}
