import { createContext, useContext } from "react";

import {
  noopScholarshipCheckoutInvalidator,
  type ScholarshipCheckoutInvalidator,
} from "./scholarshipCheckoutInvalidator";

// Scholarship Pricing + Capacity slice: lets the Deal edit UI reach
// whichever ScholarshipCheckoutInvalidator CRM.tsx resolved (the real
// Supabase Edge Function call in production, a no-op in FakeRest/demo)
// without prop-drilling through every route — same purpose as
// ConfigurationContext, scoped to this one concern. Defaults to the noop
// so any component/test can call useScholarshipCheckoutInvalidator()
// without needing to wrap in a Provider first.
const ScholarshipCheckoutInvalidatorContext =
  createContext<ScholarshipCheckoutInvalidator>(
    noopScholarshipCheckoutInvalidator,
  );

export const ScholarshipCheckoutInvalidatorProvider =
  ScholarshipCheckoutInvalidatorContext.Provider;

export const useScholarshipCheckoutInvalidator =
  (): ScholarshipCheckoutInvalidator =>
    useContext(ScholarshipCheckoutInvalidatorContext);
