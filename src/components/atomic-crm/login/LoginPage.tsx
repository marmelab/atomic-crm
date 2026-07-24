import { useState, useEffect } from "react";
import { useLogin } from "ra-core";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const ATTEMPTS_KEY = "app_login_attempts";

function getBlockedUntil(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const data = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || "{}");
    if (data.blockedUntil && Date.now() < data.blockedUntil) {
      return data.blockedUntil;
    }
  } catch {
    // ignore
  }
  return null;
}

export const LoginPage = () => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const [remaining, setRemaining] = useState("");
  const login = useLogin();

  useEffect(() => {
    const blocked = getBlockedUntil();
    if (blocked) {
      setBlockedUntil(blocked);
    }
  }, []);

  useEffect(() => {
    if (!blockedUntil) return;
    const update = () => {
      const diff = blockedUntil - Date.now();
      if (diff <= 0) {
        setBlockedUntil(null);
        setRemaining("");
        return;
      }
      const mins = Math.ceil(diff / 60000);
      setRemaining(`${mins} minute${mins > 1 ? "s" : ""}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [blockedUntil]);

  const isBlocked = blockedUntil !== null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login({ password });
    } catch (err: any) {
      setError(err.message || "Erreur de connexion");
      const blocked = getBlockedUntil();
      if (blocked) setBlockedUntil(blocked);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900">
      <div className="w-full max-w-sm p-8">
        <h1 className="text-2xl font-semibold text-white text-center mb-8">
          Accès
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            placeholder="Mot de passe"
            disabled={isBlocked}
            className="text-white placeholder:text-zinc-500 bg-zinc-800 border-zinc-700 focus-visible:ring-zinc-600"
            autoFocus
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {isBlocked && remaining && (
            <p className="text-amber-400 text-sm">
              Bloqué. Réessayez dans {remaining}.
            </p>
          )}
          <Button
            type="submit"
            disabled={isBlocked || !password}
            className="w-full cursor-pointer"
            variant="secondary"
          >
            {isBlocked ? "Bloqué" : "Connexion"}
          </Button>
        </form>
      </div>
    </div>
  );
};
