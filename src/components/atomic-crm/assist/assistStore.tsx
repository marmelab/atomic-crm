import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AssistContextValue = {
  isOpen: boolean;
  initialMessage: string | null;
  open: (initialMessage?: string) => void;
  close: () => void;
};

const AssistContext = createContext<AssistContextValue | null>(null);

export function AssistProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialMessage, setInitialMessage] = useState<string | null>(null);

  const open = useCallback((message?: string) => {
    setInitialMessage(message ?? null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    // Clear the seed message after the close animation so re-opening from the
    // FAB starts fresh.
    setTimeout(() => setInitialMessage(null), 300);
  }, []);

  const value = useMemo(
    () => ({ isOpen, initialMessage, open, close }),
    [isOpen, initialMessage, open, close],
  );

  return (
    <AssistContext.Provider value={value}>{children}</AssistContext.Provider>
  );
}

export function useAssist() {
  const ctx = useContext(AssistContext);
  if (!ctx) {
    throw new Error("useAssist must be used inside <AssistProvider>");
  }
  return ctx;
}
