import { useGetList } from "ra-core";

import type { ApplicationResponse } from "../types";
import type { Identifier } from "ra-core";

// The questions this person was actually asked, in the order they were
// asked, with the words they actually wrote.
//
// ApplicationAnswers (still used for native submissions) reconstructs the
// question from answerLabels.ts at render time, which means an edit to
// that file changes what a historical Application claims to have asked.
// These rows carry their own question text, so nothing can rewrite them
// after the fact — including the two Notion forms that differ by a single
// clause ("...helps you create?" vs "...helps you create in your life and
// relationships?").
export const ApplicationResponses = ({
  applicationId,
}: {
  applicationId: Identifier;
}) => {
  const { data: responses, isPending } = useGetList<ApplicationResponse>(
    "application_responses",
    {
      filter: { application_id: applicationId },
      pagination: { page: 1, perPage: 100 },
      // Source order, never alphabetical and never by id.
      sort: { field: "position", order: "ASC" },
    },
  );

  if (isPending) return null;
  if (!responses || responses.length === 0) return null;

  return (
    <dl className="flex flex-col gap-4">
      {responses.map((response) => (
        <div key={response.id} className="flex flex-col gap-1">
          <dt className="text-sm font-medium">{response.question_text}</dt>
          <dd className="text-sm text-muted-foreground">
            {response.answered ? (
              <AnswerText text={response.answer_text ?? ""} />
            ) : (
              // Asked and left blank. Saying so is more truthful than an
              // empty row, which reads as a rendering bug.
              <span className="italic">No answer given</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
};

// Stored text is exact and is never edited to make it render.
//
// The recovered Notion export happens to contain no <br> markers at all —
// checked across all 218 preserved snapshots — but paragraph breaks do
// arrive as real newlines, and a <dd> would otherwise collapse them into
// one run-on block. Splitting for display leaves the stored value alone.
const AnswerText = ({ text }: { text: string }) => {
  const paragraphs = text.split(/\r?\n/);
  if (paragraphs.length === 1) return <>{text}</>;

  return (
    <>
      {paragraphs.map((line, index) => (
        // Lines have no identity of their own, and the list is static for
        // the lifetime of the row, so position is a safe key here.
        <span key={index} className="block">
          {line === "" ? " " : line}
        </span>
      ))}
    </>
  );
};
