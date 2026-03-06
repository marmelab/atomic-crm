import { BlobProvider } from "@react-pdf/renderer";
import { QuotePDFDocument, type QuotePDFProps } from "./QuotePDF";

const QuoteCardPDFPreview = (props: QuotePDFProps) => (
  <BlobProvider document={<QuotePDFDocument {...props} />}>
    {({ url, loading }) =>
      loading ? (
        <div className="h-100 flex items-center justify-center text-sm text-muted-foreground">
          Generazione anteprima...
        </div>
      ) : url ? (
        <div className="max-w-full overflow-hidden">
          <iframe
            src={url}
            className="w-full h-100 rounded border-0"
            title="Anteprima PDF"
          />
        </div>
      ) : (
        <div className="h-100 flex items-center justify-center text-sm text-muted-foreground">
          Errore generazione PDF
        </div>
      )
    }
  </BlobProvider>
);

export default QuoteCardPDFPreview;
