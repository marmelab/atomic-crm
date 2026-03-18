import { useCallback, useState } from "react";
import { useDataProvider, useNotify } from "ra-core";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  LogOut,
  Plug,
  ShieldOff,
  Calendar,
  Mail,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { CrmDataProvider } from "../providers/types";
import {
  useGoogleConnectionStatus,
  useInvalidateGoogleStatus,
} from "../google/useGoogleConnectionStatus";
import type { GooglePreferences } from "../google/types";

const CONNECTORS = [
  { id: "google", label: "Google Workspace" },
  { id: "dropcontact", label: "Dropcontact" },
  { id: "lemlist", label: "Lemlist" },
];

export const ConnectorsPage = () => {
  return (
    <div className="flex gap-8 mt-4 pb-20">
      {/* Left navigation */}
      <nav className="hidden md:block w-48 shrink-0">
        <div className="sticky top-4 space-y-1">
          <h1 className="text-2xl font-semibold px-3 mb-2">Connecteurs</h1>
          {CONNECTORS.map((connector) => (
            <button
              key={connector.id}
              type="button"
              onClick={() => {
                document
                  .getElementById(connector.id)
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="block w-full text-left px-3 py-1 text-sm rounded-md hover:text-foreground hover:bg-muted transition-colors"
            >
              {connector.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 min-w-0 max-w-2xl space-y-6">
        <GoogleConnectorCard />

        <ComingSoonCard
          id="dropcontact"
          name="Dropcontact"
          description="Enrichissement automatique de contacts B2B : emails professionnels, numéros de téléphone, informations entreprise."
          icon="https://www.dropcontact.com/favicon.ico"
        />

        <ComingSoonCard
          id="lemlist"
          name="Lemlist"
          description="Automatisation d'emails de prospection et suivi des campagnes outbound."
          icon="https://www.lemlist.com/favicon.ico"
        />
      </div>
    </div>
  );
};

ConnectorsPage.path = "/connectors";

// ── Google Connector ──────────────────────────────────────────────

const GoogleConnectorCard = () => {
  const { data: status, isPending } = useGoogleConnectionStatus();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const invalidate = useInvalidateGoogleStatus();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    try {
      const { url } = await dataProvider.getGoogleOAuthUrl();
      window.location.href = url;
    } catch {
      notify("Erreur lors de la connexion Google", { type: "error" });
      setConnecting(false);
    }
  }, [dataProvider, notify]);

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      await dataProvider.disconnectGoogle();
      invalidate();
      notify("Compte Google déconnecté");
    } catch {
      notify("Erreur lors de la déconnexion", { type: "error" });
    } finally {
      setDisconnecting(false);
    }
  }, [dataProvider, notify, invalidate]);

  const handleRevoke = useCallback(async () => {
    setDisconnecting(true);
    try {
      await dataProvider.revokeGoogle();
      invalidate();
      notify("Accès Google révoqué");
    } catch {
      notify("Erreur lors de la révocation", { type: "error" });
    } finally {
      setDisconnecting(false);
    }
  }, [dataProvider, notify, invalidate]);

  const handlePreferenceChange = useCallback(
    async (key: keyof GooglePreferences, value: boolean) => {
      if (!status?.preferences) return;
      try {
        await dataProvider.updateGooglePreferences({
          ...status.preferences,
          [key]: value,
        });
        invalidate();
      } catch {
        notify("Erreur lors de la mise à jour", { type: "error" });
      }
    },
    [dataProvider, status, notify, invalidate],
  );

  const connected = status?.connected ?? false;
  const preferences = status?.preferences;

  return (
    <Card id="google">
      <CardContent className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white border flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold">Google Workspace</h2>
              <p className="text-sm text-muted-foreground">
                Gmail, Calendar, Contacts
              </p>
            </div>
          </div>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : connected ? (
            <Badge
              variant="outline"
              className="text-green-700 border-green-300 bg-green-50 dark:text-green-400 dark:border-green-800 dark:bg-green-950"
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Connecté
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Non connecté
            </Badge>
          )}
        </div>

        <Separator />

        {/* Connection status & actions */}
        {connected ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connecté en tant que{" "}
              <span className="font-medium text-foreground">
                {status?.email}
              </span>
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4 mr-1" />
                )}
                Se déconnecter
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRevoke}
                disabled={disconnecting}
                className="text-destructive hover:text-destructive"
              >
                <ShieldOff className="h-4 w-4 mr-1" />
                Révoquer l'accès
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connectez votre compte Google pour synchroniser vos emails,
              rendez-vous et contacts.
            </p>
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Plug className="h-4 w-4 mr-1" />
              )}
              Connecter Google
            </Button>
          </div>
        )}

        {/* Preferences (only shown when connected) */}
        {connected && preferences && (
          <>
            <Separator />
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">
                Options d'affichage
              </h3>

              <PreferenceToggle
                icon={<Calendar className="h-4 w-4" />}
                label="Afficher les rendez-vous sur le tableau de bord"
                description="Vos prochains rendez-vous Google Calendar apparaissent sur le dashboard"
                checked={preferences.showCalendarOnDashboard}
                onChange={(v) =>
                  handlePreferenceChange("showCalendarOnDashboard", v)
                }
              />

              <PreferenceToggle
                icon={<Mail className="h-4 w-4" />}
                label="Afficher les emails sur les fiches contacts"
                description="L'historique des échanges email est visible sur chaque fiche contact"
                checked={preferences.showEmailsOnContact}
                onChange={(v) =>
                  handlePreferenceChange("showEmailsOnContact", v)
                }
              />

              <PreferenceToggle
                icon={<Calendar className="h-4 w-4" />}
                label="Afficher les rendez-vous sur les fiches contacts"
                description="Les rendez-vous Calendar liés à un contact sont visibles sur sa fiche"
                checked={preferences.showCalendarOnContact}
                onChange={(v) =>
                  handlePreferenceChange("showCalendarOnContact", v)
                }
              />

              <PreferenceToggle
                icon={<Users className="h-4 w-4" />}
                label="Synchroniser les contacts Google"
                description="Importer vos contacts Google dans le CRM (correspondance par email)"
                checked={preferences.syncContacts}
                onChange={(v) => handlePreferenceChange("syncContacts", v)}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

const PreferenceToggle = ({
  icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) => (
  <div className="flex items-start justify-between gap-4">
    <div className="flex gap-3">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="space-y-0.5">
        <Label className="text-sm font-normal cursor-pointer">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

// ── Coming Soon Cards ─────────────────────────────────────────────

const ComingSoonCard = ({
  id,
  name,
  description,
  icon,
}: {
  id: string;
  name: string;
  description: string;
  icon: string;
}) => (
  <Card id={id} className="opacity-60">
    <CardContent className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted border flex items-center justify-center">
            <img
              src={icon}
              alt={name}
              className="w-6 h-6"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{name}</h2>
          </div>
        </div>
        <Badge variant="secondary">Bientôt disponible</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
);
