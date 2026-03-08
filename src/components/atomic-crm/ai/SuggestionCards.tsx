import { useState } from "react";

import { suggestionCategories } from "@/lib/ai/suggestedQuestionCategories";

type SuggestionCardsProps = {
  disabled: boolean;
  onSelect: (question: string) => void;
};

export const SuggestionCards = ({
  disabled,
  onSelect,
}: SuggestionCardsProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = suggestionCategories[activeIndex];

  return (
    <div className="flex h-full flex-col items-center justify-end gap-3 pb-2">
      <p className="text-center text-sm text-[#8E8E93]">
        Scegli un tema o scrivi una domanda libera.
      </p>

      <div className="flex w-full gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none">
        {suggestionCategories.map((cat, i) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => setActiveIndex(i)}
            className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
              i === activeIndex
                ? "border-[#2C3E50] bg-[#2C3E50] text-white"
                : "border-[#D1D1D6] bg-[#E8EDF2] text-[#2C3E50] hover:bg-[#2C3E50]/10"
            }`}
          >
            {cat.title}
          </button>
        ))}
      </div>

      <div className="grid w-full grid-cols-1 gap-1.5">
        {active.questions.map((question) => (
          <button
            key={question}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(question)}
            className="rounded-lg border border-[#D1D1D6] bg-white px-3 py-2.5 text-left text-xs leading-snug text-[#3A3A3C] transition-colors hover:border-[#456B6B] hover:bg-[#E8EDF2] disabled:opacity-50"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
};
