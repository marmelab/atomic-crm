import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useDataProvider, useNotify } from "ra-core";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { CrmDataProvider } from "../providers/types";
import { useInvalidateGoogleStatus } from "./useGoogleConnectionStatus";

export const GoogleOAuthCallback = () => {
  const navigate = useNavigate();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const invalidate = useInvalidateGoogleStatus();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const exchangedRef = useRef(false);

  useEffect(() => {
    if (exchangedRef.current) return;
    exchangedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");

    if (error || !code) {
      setStatus("error");
      notify(error || "Authentification Google annulée", { type: "error" });
      setTimeout(() => navigate("/connectors"), 2000);
      return;
    }

    dataProvider
      .exchangeGoogleOAuthCode(code)
      .then(() => {
        setStatus("success");
        invalidate();
        notify("Compte Google connecté avec succès");
        setTimeout(() => navigate("/connectors"), 1500);
      })
      .catch((err: Error) => {
        setStatus("error");
        notify(err.message || "Erreur de connexion Google", { type: "error" });
        setTimeout(() => navigate("/connectors"), 2000);
      });
  }, [dataProvider, navigate, notify, invalidate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        {status === "loading" && (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">
              Connexion à Google en cours...
            </p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="h-8 w-8 mx-auto text-green-600" />
            <p className="text-green-600">
              Compte Google connecté ! Redirection...
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="h-8 w-8 mx-auto text-destructive" />
            <p className="text-destructive">
              Erreur de connexion. Redirection...
            </p>
          </>
        )}
      </div>
    </div>
  );
};

GoogleOAuthCallback.path = "/google-oauth-callback";
