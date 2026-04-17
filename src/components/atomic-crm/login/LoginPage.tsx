import { useEffect, useRef, useState } from "react";
import { Form, required, useLogin, useNotify } from "ra-core";
import type { SubmitHandler, FieldValues } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/admin/text-input";
import { Notification } from "@/components/admin/notification";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext.tsx";
import { SSOAuthButton } from "./SSOAuthButton";
import { GOOGLE_SSO_ENABLED } from "./googleSsoFeatureFlag";

export const LoginPage = (props: { redirectTo?: string }) => {
  const { title, googleWorkplaceDomain, disableEmailPasswordAuthentication } =
    useConfigurationContext();
  const { redirectTo } = props;
  const [loading, setLoading] = useState(false);
  const hasDisplayedRecoveryNotification = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const login = useLogin();
  const notify = useNotify();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const shouldNotify = searchParams.get("passwordRecoveryEmailSent") === "1";
    if (!shouldNotify || hasDisplayedRecoveryNotification.current) return;
    hasDisplayedRecoveryNotification.current = true;
    notify(
      "If you're a registered user, you should receive a password recovery email shortly.",
      { type: "success" },
    );
    searchParams.delete("passwordRecoveryEmailSent");
    const nextSearch = searchParams.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate, notify]);

  const handleSubmit: SubmitHandler<FieldValues> = (values) => {
    setLoading(true);
    login(values, redirectTo)
      .then(() => setLoading(false))
      .catch((error) => {
        setLoading(false);
        notify(
          typeof error === "string"
            ? error
            : typeof error === "undefined" || !error.message
              ? "ra.auth.sign_in_error"
              : error.message,
          {
            type: "error",
            messageArgs: {
              _:
                typeof error === "string"
                  ? error
                  : error && error.message
                    ? error.message
                    : undefined,
            },
          },
        );
      });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
      {/* Blobs de fond globaux */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-24 -left-24 w-[380px] h-[380px] rounded-full opacity-40"
          style={{
            background: "radial-gradient(circle, #FF9B54 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute top-1/2 -right-32 w-[300px] h-[300px] rounded-full opacity-20"
          style={{
            background: "radial-gradient(circle, #92B592 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-16 left-1/3 w-[220px] h-[220px] rounded-full opacity-15"
          style={{
            background: "radial-gradient(circle, #FF9B54 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative z-10 grid w-full max-w-[950px] mx-auto px-6 lg:grid-cols-2 lg:gap-12 min-h-screen lg:min-h-0 lg:items-center">
        {/* ── Panneau gauche ── */}
        <div className="hidden lg:flex flex-col py-16 pr-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img
              src="/appIcon/40.png"
              alt="Nosho"
              className="w-10 h-10 rounded-xl shadow-sm flex-shrink-0 object-cover"
            />
            <span className="text-lg font-semibold text-gray-900 tracking-tight">
              {title}
            </span>
          </div>

          {/* Hero text */}
          <div className="space-y-5 mt-16">
            <h1 className="text-3xl xl:text-4xl font-bold text-gray-900 leading-tight">
              Gérez vos clients,{" "}
              <span style={{ color: "#FF9B54" }}>
                développez votre chiffre d'affaires.
              </span>
            </h1>

            {/* Feature cards */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              {[
                {
                  icon: "🎯",
                  title: "Pipeline visuel",
                  desc: "Suivez chaque opportunité de la prospection à la signature",
                },
                {
                  icon: "⚡",
                  title: "Alertes en temps réel",
                  desc: "Notifications Slack instantanées à chaque nouveau deal",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl p-4 border border-gray-100 shadow-sm"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.8)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <span className="text-xl">{f.icon}</span>
                  <p className="mt-1.5 font-semibold text-gray-900 text-sm">
                    {f.title}
                  </p>
                  <p className="mt-0.5 text-gray-500 text-xs leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-xs text-gray-400 mt-auto pt-16">
            © {new Date().getFullYear()} Nosho · Tous droits réservés
          </p>
        </div>

        {/* ── Panneau droit (formulaire) ── */}
        <div className="flex flex-col justify-center items-center w-full py-16 lg:pl-8">
          {/* Logo mobile */}
          <div className="flex lg:hidden items-center gap-2 mb-10">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "#FF9B54" }}
            >
              <img
                src="/appIcon/32.png"
                alt="Nosho"
                className="w-6 h-6 object-contain"
                style={{ filter: "brightness(0) invert(1)" }}
              />
            </div>
            <span className="font-semibold text-gray-900">{title}</span>
          </div>

          {/* Card formulaire */}
          <div
            className="w-full max-w-sm rounded-3xl border border-gray-100 p-8 shadow-xl"
            style={{
              backgroundColor: "rgba(255,255,255,0.9)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900">
                Bon retour 👋
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Connectez-vous à votre espace CRM
              </p>
            </div>

            {!disableEmailPasswordAuthentication && (
              <Form className="space-y-5" onSubmit={handleSubmit}>
                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <TextInput
                    label=""
                    source="email"
                    type="email"
                    validate={required()}
                    className="[&_input]:rounded-xl [&_input]:border-gray-200 [&_input]:bg-gray-50 [&_input]:focus:border-[#FF9B54] [&_input]:focus:ring-[#FF9B54]/20"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">
                      Mot de passe
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-xs font-medium hover:underline"
                      style={{ color: "#FF9B54" }}
                    >
                      Mot de passe oublié ?
                    </Link>
                  </div>
                  <TextInput
                    label=""
                    source="password"
                    type="password"
                    validate={required()}
                    className="[&_input]:rounded-xl [&_input]:border-gray-200 [&_input]:bg-gray-50 [&_input]:focus:border-[#FF9B54] [&_input]:focus:ring-[#FF9B54]/20"
                  />
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl h-11 font-semibold text-white cursor-pointer shadow-md hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: "#FF9B54", borderColor: "#FF9B54" }}
                >
                  {loading ? "Connexion…" : "Se connecter"}
                </Button>
              </Form>
            )}

            {GOOGLE_SSO_ENABLED && googleWorkplaceDomain && (
              <div className="mt-4">
                <SSOAuthButton
                  className="w-full rounded-xl"
                  domain={googleWorkplaceDomain}
                >
                  Continuer avec Google
                </SSOAuthButton>
              </div>
            )}

            {disableEmailPasswordAuthentication && (
              <Link
                to="/forgot-password"
                className="block text-sm text-center mt-4 hover:underline"
                style={{ color: "#FF9B54" }}
              >
                Mot de passe oublié ?
              </Link>
            )}
          </div>
        </div>
      </div>

      <Notification />
    </div>
  );
};
