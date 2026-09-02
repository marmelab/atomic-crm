import { useState, type FormEvent } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ApplicationQuestion = {
  key: string;
  label: string;
  required: boolean;
  placeholder?: string;
};

export type ApplicationFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  answers: Record<string, string>;
};

const emptyValues = (
  questions: ApplicationQuestion[],
): ApplicationFormValues => ({
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
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
    if (Object.keys(errors).length > 0) return;

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
      setFormError("Something went wrong on our end. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex flex-col gap-2 text-center py-4">
        <p className="text-base font-medium">Application received</p>
        <p className="text-sm text-muted-foreground">
          Thank you — we'll be in touch about next steps.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
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
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field id="firstName" label="First name" error={fieldErrors.firstName}>
          <Input
            id="firstName"
            autoComplete="given-name"
            value={values.firstName}
            aria-invalid={!!fieldErrors.firstName}
            onChange={(e) =>
              setValues((v) => ({ ...v, firstName: e.target.value }))
            }
          />
        </Field>
        <Field id="lastName" label="Last name" error={fieldErrors.lastName}>
          <Input
            id="lastName"
            autoComplete="family-name"
            value={values.lastName}
            aria-invalid={!!fieldErrors.lastName}
            onChange={(e) =>
              setValues((v) => ({ ...v, lastName: e.target.value }))
            }
          />
        </Field>
      </div>

      <Field id="email" label="Email" error={fieldErrors.email}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={values.email}
          aria-invalid={!!fieldErrors.email}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
        />
      </Field>

      <Field id="phone" label="Phone (optional)">
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          value={values.phone}
          onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
        />
      </Field>

      {questions.map((question) => (
        <Field
          key={question.key}
          id={question.key}
          label={
            question.required ? question.label : `${question.label} (optional)`
          }
          error={fieldErrors[question.key]}
        >
          <Textarea
            id={question.key}
            rows={4}
            placeholder={question.placeholder}
            // Client-side mirror of submitApplication.ts's own
            // MAX_ANSWER_LENGTH (defense in depth / better UX — the
            // server-side check is the real enforcement boundary, since a
            // scripted caller never runs this client code at all).
            maxLength={5000}
            value={values.answers[question.key] ?? ""}
            aria-invalid={!!fieldErrors[question.key]}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                answers: { ...v.answers, [question.key]: e.target.value },
              }))
            }
          />
        </Field>
      ))}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Submitting…" : "Submit application"}
      </Button>
    </form>
  );
};

const Field = ({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1.5">
    <Label htmlFor={id}>{label}</Label>
    {children}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);
