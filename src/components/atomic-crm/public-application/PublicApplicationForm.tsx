import { useState, type FormEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ApplicationQuestion = {
  key: string;
  // ReactNode, not just string: Real LE + GYU Application Forms slice,
  // human-acceptance round 1 — Growing Yourself Up's "now" needs to render
  // in italics within an otherwise-plain question (semantic <em>, not raw
  // HTML). The CRM review label map (applications/answerLabels.ts) is a
  // wholly separate, independent constant and stays a plain string there
  // — the italics are a public-form visual treatment only, not a content
  // change to what a reviewer reads.
  label: ReactNode;
  required: boolean;
  placeholder?: string;
  // Real Living Example / Growing Yourself Up copy slice: Leif's own
  // Notion questionnaires pair every question with a short italicized
  // clarifying line ("(Be specific—what keeps happening?)") — kept as its
  // own field rather than folded into `label` so the visual weight (bold
  // question / muted helper) stays consistent regardless of how long
  // either string is.
  helperText?: string;
  // "short" is a single-line Input (the 1-10 commitment-scale question);
  // every other question is "long" (Textarea), the pre-existing default.
  // Deliberately not a new slider/radio widget — Phase 3/4 both call for
  // "the simplest existing input model that fits the system," and this
  // app already has exactly these two.
  inputType?: "long" | "short";
};

export type ApplicationFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  answers: Record<string, string>;
};

const emptyValues = (
  questions: ApplicationQuestion[],
): ApplicationFormValues => ({
  firstName: "",
  lastName: "",
  email: "",
  answers: Object.fromEntries(questions.map((q) => [q.key, ""])),
});

// Honeypot (§15: "treat this as a serious first public write surface"): a
// field named to look appealing to a bot, visually hidden and out of tab
// order, that no real applicant ever sees or fills. A non-empty value
// short-circuits BEFORE any network call — never signals anything to
// whatever filled it, mirroring the DNE auto-resolve decision's own "no
// differentiated copy" principle. Kept out of ApplicationFormValues/
// PublicApplicationInput entirely so it can never leak into the
// FakeRest/dev-testable submitApplication.ts path.

type SubmitOutcome =
  | { ok: true }
  | { ok: false; formError?: string; fieldErrors?: Record<string, string> };

// Dark, quiet, Notion-questionnaire-inspired visual language for the
// public /apply pages (Real LE + GYU Application Forms slice, Phase 5).
// Deliberately fixed dark tokens — not the app's own light/dark theme
// variables — since Leif's reference forms have one deliberate look
// regardless of a visitor's own system preference, the same way a
// standalone public questionnaire (Notion's own) always renders one way.
const inputSurface =
  "bg-white/[0.04] border-white/15 text-white placeholder:text-white/30 " +
  "focus-visible:border-white/40 focus-visible:ring-white/15 " +
  "aria-invalid:border-red-400/70 aria-invalid:ring-red-400/20";

// The public application form's shared body — used by both LivingExample-
// and GrowingYourselfUp ApplicationPage (§2-§4). No internal CRM
// vocabulary leaks into this component: no "Opportunity", no "pipeline",
// no "sales eligibility", no internal record ids — only what an applicant
// needs (§3). Validation errors keep whatever the applicant already typed
// (§4: values live in this component's own state, never reset on error).
// Duplicate-submit protection is local (disable while submitting) plus
// server-side idempotency in submitApplication.ts / the Edge Function
// (§12) — belt and suspenders, since a slow network could let a second
// click queue before the button visually disables.
export const PublicApplicationForm = ({
  questions,
  onSubmit,
}: {
  questions: ApplicationQuestion[];
  onSubmit: (values: ApplicationFormValues) => Promise<SubmitOutcome>;
}) => {
  const [values, setValues] = useState<ApplicationFormValues>(() =>
    emptyValues(questions),
  );
  const [honeypot, setHoneypot] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!values.firstName.trim()) errors.firstName = "Required.";
    if (!values.lastName.trim()) errors.lastName = "Required.";
    if (!values.email.trim()) {
      errors.email = "Required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      errors.email = "Enter a valid email.";
    }
    for (const question of questions) {
      if (question.required && !values.answers[question.key]?.trim()) {
        errors[question.key] = "Required.";
      }
    }
    return errors;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting || isSubmitted) return; // duplicate-click guard

    if (honeypot.trim() !== "") {
      // Never call the network; never let the filler know anything
      // happened differently from a real submission.
      setIsSubmitted(true);
      return;
    }

    const errors = validate();
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) {
      // Preserve entered answers (state is untouched); just surface a
      // plain-language nudge rather than relying on browser validation UI
      // alone (Phase 7: "do not rely only on browser validation").
      setFormError("Please fill in the required fields below.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onSubmit(values);
      if (result.ok) {
        setIsSubmitted(true);
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(
          result.formError ??
            "Something went wrong on our end. Please try again.",
        );
      }
    } catch {
      // Entered values are untouched (component state), so nothing is
      // lost — the applicant can just press submit again.
      setFormError(
        "Something went wrong on our end. Your answers are still here — please try submitting again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex flex-col gap-2 text-center py-6">
        <p className="text-lg font-medium text-white">Application received</p>
        <p className="text-sm text-white/50">
          Thank you — we'll be in touch about next steps.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] w-px h-px overflow-hidden"
      >
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>
      {formError && (
        <p
          role="alert"
          className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200"
        >
          {formError}
        </p>
      )}

      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <IdentityField
            id="firstName"
            label="First Name"
            required
            error={fieldErrors.firstName}
          >
            <Input
              id="firstName"
              autoComplete="given-name"
              className={inputSurface}
              value={values.firstName}
              aria-invalid={!!fieldErrors.firstName}
              onChange={(e) =>
                setValues((v) => ({ ...v, firstName: e.target.value }))
              }
            />
          </IdentityField>
          <IdentityField
            id="lastName"
            label="Last Name"
            required
            error={fieldErrors.lastName}
          >
            <Input
              id="lastName"
              autoComplete="family-name"
              className={inputSurface}
              value={values.lastName}
              aria-invalid={!!fieldErrors.lastName}
              onChange={(e) =>
                setValues((v) => ({ ...v, lastName: e.target.value }))
              }
            />
          </IdentityField>
        </div>

        <IdentityField
          id="email"
          label="Email"
          required
          error={fieldErrors.email}
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            className={inputSurface}
            value={values.email}
            aria-invalid={!!fieldErrors.email}
            onChange={(e) =>
              setValues((v) => ({ ...v, email: e.target.value }))
            }
          />
        </IdentityField>
      </div>

      {questions.map((question) => (
        <QuestionCard
          key={question.key}
          question={question}
          value={values.answers[question.key] ?? ""}
          error={fieldErrors[question.key]}
          onChange={(next) =>
            setValues((v) => ({
              ...v,
              answers: { ...v.answers, [question.key]: next },
            }))
          }
        />
      ))}

      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(
          "w-full rounded-lg bg-white text-black font-medium text-sm py-3",
          "transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
        )}
      >
        {isSubmitting ? "Submitting…" : "Submit"}
      </button>
    </form>
  );
};

// Identity fields (First/Last/Email/Phone) sit in a plain, ungrouped
// block above the questions — not wrapped in the same bordered card as a
// question (Phase 5 reserves that treatment for "each question," and a
// short structured field reads differently from an open-ended one in
// every Notion questionnaire Leif referenced).
const IdentityField = ({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1.5">
    <Label htmlFor={id} className="text-sm font-medium text-white">
      {label}
      {required && <span className="text-white/40"> *</span>}
    </Label>
    {children}
    {error && <p className="text-xs text-red-300">{error}</p>}
  </div>
);

// One question, one dark outlined card — the visual unit Phase 5 asks
// for: bold white question text, muted helper text directly below, a
// dark input surface, restrained borders, generous internal spacing.
const QuestionCard = ({
  question,
  value,
  error,
  onChange,
}: {
  question: ApplicationQuestion;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) => {
  const inputId = question.key;
  return (
    <div
      className={cn(
        "rounded-xl border bg-white/[0.02] p-5 sm:p-6 flex flex-col gap-3",
        "border-slate-600/40",
      )}
    >
      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor={inputId}
          // Human-acceptance round 1: "the question labels currently feel
          // too small compared with the Notion reference... substantially
          // more visual presence." Bumped from text-base to text-xl/2xl —
          // clearly larger than the sm helper text below it — while
          // leaving helper text and identity-field labels untouched (this
          // feedback was specifically about question labels, not
          // everything on the page).
          className="text-xl sm:text-2xl font-bold text-white leading-snug"
        >
          {/* Round 4: the shadcn Label component (components/ui/label.tsx)
              is `display:flex`, which treats every direct child as its
              own flex item. A plain string label is a single text-node
              child, so this never showed — but GYU's "now" question
              passes a Fragment of THREE children (text, <em>now</em>,
              text), and each became a separate flex item with a gap
              between them: "now" rendered as a detached, oddly-spaced
              block instead of flowing inline in the sentence. Wrapping
              the whole label (plus the required/optional marker) in one
              <span> makes it a single flex item again, so everything
              inside — including the <em> — flows as ordinary inline text
              and wraps normally. */}
          <span>
            {question.label}
            {question.required && <span className="text-white/40"> *</span>}
            {!question.required && (
              <span className="text-white/40 font-normal"> (optional)</span>
            )}
          </span>
        </Label>
        {question.helperText && (
          <p className="text-sm text-white/45 italic">{question.helperText}</p>
        )}
      </div>

      {question.inputType === "short" ? (
        <Input
          id={inputId}
          className={inputSurface}
          placeholder={question.placeholder}
          maxLength={5000}
          value={value}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Textarea
          id={inputId}
          rows={5}
          className={cn(inputSurface, "min-h-32")}
          placeholder={question.placeholder}
          // Client-side mirror of submitApplication.ts's own
          // MAX_ANSWER_LENGTH (defense in depth / better UX — the
          // server-side check is the real enforcement boundary, since a
          // scripted caller never runs this client code at all).
          maxLength={5000}
          value={value}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
};
