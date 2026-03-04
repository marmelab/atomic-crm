import { useRotatingSuggestions } from "@/hooks/useRotatingSuggestions";

type SuggestionCardsProps = {
  disabled: boolean;
  onSelect: (question: string) => void;
};

export const SuggestionCards = ({
  disabled,
  onSelect,
}: SuggestionCardsProps) => {
  const suggestions = useRotatingSuggestions();

  return (
    <div className="flex h-full flex-col items-center justify-end gap-4 pb-2">
      <p className="text-center text-sm text-muted-foreground">
        Fai una domanda operativa o usa un suggerimento rapido.
      </p>
      <div className="grid w-full grid-cols-2 gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={`${suggestion.categoryKey}-${suggestion.question}`}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(suggestion.question)}
            className="rounded-xl border bg-background p-3 text-left text-xs leading-snug text-muted-foreground transition-colors [animation:suggestion-fade-in_300ms_ease-out] hover:bg-muted/50 disabled:opacity-50"
          >
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              {suggestion.title}
            </span>
            {suggestion.question}
          </button>
        ))}
      </div>
    </div>
  );
};
