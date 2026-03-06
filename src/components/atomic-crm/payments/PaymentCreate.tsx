import { CreateBase, Form } from "ra-core";
import { useMemo } from "react";
import { useLocation } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

import { PaymentInputs } from "./PaymentInputs";
import {
  getPaymentCreateDefaultsFromSearch,
  getUnifiedAiHandoffContextFromSearch,
} from "./paymentLinking";
import { FormToolbar } from "../layout/FormToolbar";
import { MobileBackButton } from "../misc/MobileBackButton";

const getUnifiedAiBannerCopy = (search: string) => {
  const handoff = getUnifiedAiHandoffContextFromSearch(search);

  if (!handoff) {
    return null;
  }

  if (handoff.draftKind === "payment_create") {
    return "Aperto dalla chat AI unificata con una bozza pagamento modificabile. Controlla importo, tipo e stato prima di salvare: se avevi corretto l'importo nel launcher, il form lo mantiene finche non scegli tu un altro valore e finche resti sullo stesso preventivo. Se cambi preventivo, il form te lo segnala e torna a usare solo il contesto locale. Dopo il primo edit manuale dell'importo, il form non lo ricalcola piu automaticamente.";
  }

  if (handoff.action === "quote_create_payment") {
    return "Aperto dalla chat AI unificata: preventivo, cliente e progetto sono gia precompilati. Controlla i dati prima di salvare.";
  }

  if (handoff.action === "client_create_payment") {
    return "Aperto dalla chat AI unificata: il cliente e gia precompilato. Completa il pagamento e verifica eventuali collegamenti mancanti.";
  }

  return "Aperto dalla chat AI unificata: il form e' stato indirizzato qui come superficie commerciale gia approvata. Verifica i dati prima di salvare.";
};

export const PaymentCreate = () => {
  const location = useLocation();
  const defaultValues = useMemo(
    () => getPaymentCreateDefaultsFromSearch(location.search),
    [location.search],
  );
  const launcherBanner = useMemo(
    () => getUnifiedAiBannerCopy(location.search),
    [location.search],
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
                <PaymentInputs />
                <FormToolbar />
              </CardContent>
            </Card>
          </Form>
        </div>
      </div>
    </CreateBase>
  );
};
