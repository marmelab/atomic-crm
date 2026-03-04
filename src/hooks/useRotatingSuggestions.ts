import { useCallback, useEffect, useRef, useState } from "react";

import { suggestionCategories } from "@/lib/ai/suggestedQuestionCategories";

const ROTATION_INTERVAL_MS = 4_000;
const CARDS_PER_ROTATION = 2;

export type VisibleSuggestion = {
  categoryKey: string;
  title: string;
  question: string;
};

const shuffleRange = (length: number) => {
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
};

export const useRotatingSuggestions = (): VisibleSuggestion[] => {
  const categories = suggestionCategories;

  const [questionIndices, setQuestionIndices] = useState<number[]>(() =>
    categories.map(() => 0),
  );

  const rotationQueueRef = useRef<number[]>([]);

  const pickNextCategories = useCallback(() => {
    if (rotationQueueRef.current.length < CARDS_PER_ROTATION) {
      rotationQueueRef.current = shuffleRange(categories.length);
    }
    return rotationQueueRef.current.splice(0, CARDS_PER_ROTATION);
  }, [categories.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      const toRotate = pickNextCategories();

      setQuestionIndices((prev) => {
        const next = [...prev];
        for (const categoryIndex of toRotate) {
          const poolSize = categories[categoryIndex].questions.length;
          next[categoryIndex] = (next[categoryIndex] + 1) % poolSize;
        }
        return next;
      });
    }, ROTATION_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [categories, pickNextCategories]);

  return categories.map((category, i) => ({
    categoryKey: category.key,
    title: category.title,
    question: category.questions[questionIndices[i]],
  }));
};
