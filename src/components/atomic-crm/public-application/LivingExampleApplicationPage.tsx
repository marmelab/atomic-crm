import { useEffect, useState } from "react";

import type { PublicApplicationDataSource } from "./publicApplicationDataSource";
import type { PublicOfferContext } from "./publicOfferContext";
import { PublicApplicationLayout } from "./PublicApplicationLayout";
import {
  PublicApplicationForm,
  type ApplicationQuestion,
} from "./PublicApplicationForm";
import { NotFoundNotice } from "./NotFoundNotice";

const QUESTIONS: ApplicationQuestion[] = [
  {
    key: "why_this_program",
    label: "Why this program?",
    required: true,
    placeholder: "What made you want to apply?",
  },
];

// /apply/living-example — the native public application form for the
// individual 1:1 Offer (§2A). The Offer is discovered the same way the
// rest of the app already does (no hardcoded id/name — see
// publicOfferContext.ts), so this page keeps working if the Offer is ever
// renamed or recreated.
export const LivingExampleApplicationPage = ({
  dataSource,
}: {
  dataSource: PublicApplicationDataSource;
}) => {
  const [context, setContext] = useState<PublicOfferContext | "pending">(
    "pending",
  );

  useEffect(() => {
    let cancelled = false;
    dataSource.getLivingExampleContext().then((result) => {
      if (!cancelled) setContext(result);
    });
    return () => {
      cancelled = true;
    };
  }, [dataSource]);

  if (context === "pending") return null;
  if (context.kind !== "individual") {
    return (
      <PublicApplicationLayout
        title="Apply"
        orientation="This application isn't available right now."
      >
        <NotFoundNotice />
      </PublicApplicationLayout>
    );
  }

  return (
    <PublicApplicationLayout
      title={context.offerName}
      orientation="A few questions to get to know you and your fit for the program."
    >
      <PublicApplicationForm
        questions={QUESTIONS}
        onSubmit={async (values) => {
          const result = await dataSource.submitApplication({
            offerId: context.offerId,
            firstName: values.firstName,
            lastName: values.lastName,
            email: values.email,
            phone: values.phone || null,
            answers: values.answers,
          });
          if (result.status === "submitted") return { ok: true };
          if (result.status === "validation-error") {
            return { ok: false, formError: result.message };
          }
          return {
            ok: false,
            formError: "This application isn't available right now.",
          };
        }}
      />
    </PublicApplicationLayout>
  );
};

LivingExampleApplicationPage.path = "/apply/living-example";
