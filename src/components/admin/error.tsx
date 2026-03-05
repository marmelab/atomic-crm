import type { FallbackProps } from "react-error-boundary";
import { useResetErrorBoundaryOnLocationChange, Translate } from "ra-core";
import { CircleAlert, History } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import type { HtmlHTMLAttributes, ErrorInfo } from "react";

/**
 * App-wide error component for displaying error boundaries.
 *
 * Displays the error message and a back button.
 * In development mode, also shows the component stack trace in an expandable accordion.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/error Error documentation}
 */
export const Error = (props: InternalErrorProps & {}) => {
  const { error, errorInfo, resetErrorBoundary, ...rest } = props;

  useResetErrorBoundaryOnLocationChange(resetErrorBoundary);

  const errorMessage: string =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
      ? (error.message ?? "")
      : typeof error === "string"
        ? error
        : String(error ?? "Errore sconosciuto");

  return (
    <div
      className="flex flex-col items-center px-4 py-8 md:p-16 gap-5"
      {...rest}
    >
      <h1
        className="flex items-center text-2xl md:text-3xl mt-2 md:mt-5 mb-3 md:mb-5 gap-3"
        role="alert"
      >
        <CircleAlert className="w-6 h-6 md:w-8 md:h-8 shrink-0" />
        <Translate i18nKey="ra.page.error" />
      </h1>
      <div className="text-sm md:text-base text-center">
        <Translate i18nKey="ra.message.error" />
      </div>
      <Accordion
        type="multiple"
        className="mt-1 p-2 bg-secondary w-full lg:w-150"
      >
        <AccordionItem value="error">
          <AccordionTrigger className="py-2 text-left text-sm">
            <Translate i18nKey={errorMessage}>{errorMessage}</Translate>
          </AccordionTrigger>
          <AccordionContent className="whitespace-pre-wrap pt-1 overflow-x-auto">
            {errorInfo?.componentStack && (
              <pre className="text-xs">{errorInfo.componentStack}</pre>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <p className="text-center text-sm text-muted-foreground">
        Prova a ricaricare la pagina o a tornare indietro.
        <br />
        Se il problema persiste, contatta l&apos;amministratore.
      </p>
      <div className="mt-4 md:mt-8">
        <Button onClick={goBack}>
          <History />
          <Translate i18nKey="ra.action.back" />
        </Button>
      </div>
    </div>
  );
};

interface InternalErrorProps
  extends Omit<HtmlHTMLAttributes<HTMLDivElement>, "title">,
    FallbackProps {
  className?: string;
  errorInfo?: ErrorInfo;
}

export interface ErrorProps extends Pick<FallbackProps, "error"> {
  errorInfo?: ErrorInfo;
}

function goBack() {
  window.history.go(-1);
}
