import { labelForAnswerKey } from "./answerLabels";

// Renders raw_answers as readable Q&A pairs — never a raw key like
// "why_this_program" (Native Applications slice, §2). Answers are jsonb
// with no fixed schema, so an unexpected value shape (not a string) is
// stringified rather than dropped.
export const ApplicationAnswers = ({
  answers,
}: {
  answers: Record<string, unknown>;
}) => {
  const entries = Object.entries(answers ?? {});
  if (entries.length === 0) return null;

  return (
    <dl className="flex flex-col gap-3">
      {entries.map(([key, value]) => (
        <div key={key} className="flex flex-col gap-0.5">
          <dt className="text-sm font-medium">{labelForAnswerKey(key)}</dt>
          <dd className="text-sm text-muted-foreground">
            {typeof value === "string" ? value : JSON.stringify(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
};
