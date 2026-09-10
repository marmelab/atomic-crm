import {
  withLifecycleCallbacks,
  type CreateParams,
  type DataProvider,
  type Identifier,
  type ResourceCallbacks,
  type UpdateParams,
} from "ra-core";
import fakeRestDataProvider from "ra-data-fakerest";

import type {
  Cohort,
  Company,
  Contact,
  ContactNote,
  Deal,
  DealNote,
  Enrollment,
  EnrollmentOffboardingItem,
  EnrollmentOnboardingItem,
  Offer,
  OfferPaymentOption,
  OffboardingRequirementTemplate,
  OnboardingRequirementTemplate,
  Sale,
  SalesCall,
  SalesFormData,
  SignUpData,
  Task,
  WaitlistEntry,
} from "../../types";
import type { ConfigurationContextValue } from "../../root/ConfigurationContext";
import { validateOfferCohort } from "../../deals/offerCohortValidation";
import {
  assertNoOfferChangeWhileScholarship,
  assertPaymentOptionMatchesPricingMode,
  assertPricingModeImmutableOnceWon,
  assertScholarshipGrantedOnlyViaEdit,
  claimScholarshipSlotForDeal,
  reclaimScholarshipSlotForEnrollment,
  releaseScholarshipSlotForDeal,
  releaseScholarshipSlotForEnrollment,
  transitionScholarshipSlotToEnrollment,
} from "../../deals/scholarshipSlotValidation";
import { getActivityLog } from "../commons/activity";
import { getCompanyAvatar } from "../commons/getCompanyAvatar";
import { getContactAvatar } from "../commons/getContactAvatar";
import { mergeContacts } from "../commons/mergeContacts";
import { assertNoDuplicateActiveWaitlistEntry } from "../../waitlist/waitlistEntryValidation";
import { ACTIVE_WAITLIST_STATUSES } from "../../waitlist/waitlistConstants";
import { syncWaitlistForActiveDeal } from "../../waitlist/waitlistSync";
import type { CrmDataProvider } from "../types";
import {
  authProvider as defaultAuthProvider,
  USER_STORAGE_KEY,
} from "./authProvider";
import generateData from "./dataGenerator";
import type { Db } from "./dataGenerator/types";
import { withSupabaseFilterAdapter } from "./internal/supabaseAdapter";
import { syncContactRelationshipFields } from "./contactRelationshipFields";
import { syncDealSalesCallAt } from "../../sales-calls/syncDealSalesCallAt";
import { ensureDealStageEvent } from "../../deals/ensureDealStageEvent";
import { assertNoDuplicateBookedSalesCall } from "../../sales-calls/salesCallValidation";

const TASK_MARKED_AS_DONE = "TASK_MARKED_AS_DONE";
const TASK_MARKED_AS_UNDONE = "TASK_MARKED_AS_UNDONE";
const TASK_DONE_NOT_CHANGED = "TASK_DONE_NOT_CHANGED";

const processCompanyLogo = async (params: any) => {
  let logo = params.data.logo;

  if (typeof logo !== "object" || logo === null || !logo.src) {
    logo = await getCompanyAvatar(params.data);
  } else if (logo.rawFile instanceof File) {
    const base64Logo = await convertFileToBase64(logo);
    logo = { src: base64Logo, title: logo.title };
  }

  return {
    ...params,
    data: {
      ...params.data,
      logo,
    },
  };
};

async function processContactAvatar(
  params: UpdateParams<Contact>,
): Promise<UpdateParams<Contact>>;

async function processContactAvatar(
  params: CreateParams<Contact>,
): Promise<CreateParams<Contact>>;

async function processContactAvatar(
  params: CreateParams<Contact> | UpdateParams<Contact>,
): Promise<CreateParams<Contact> | UpdateParams<Contact>> {
  const { data } = params;
  if (data.avatar?.src || !data.email_jsonb || !data.email_jsonb.length) {
    return params;
  }
  const avatarUrl = await getContactAvatar(data);

  // Clone the data and modify the clone
  const newData = { ...data, avatar: { src: avatarUrl || undefined } };

  return { ...params, data: newData };
}

async function fetchAndUpdateCompanyData(
  params: UpdateParams<Contact>,
  dataProvider: DataProvider,
): Promise<UpdateParams<Contact>>;

async function fetchAndUpdateCompanyData(
  params: CreateParams<Contact>,
  dataProvider: DataProvider,
): Promise<CreateParams<Contact>>;

async function fetchAndUpdateCompanyData(
  params: CreateParams<Contact> | UpdateParams<Contact>,
  dataProvider: DataProvider,
): Promise<CreateParams<Contact> | UpdateParams<Contact>> {
  const { data } = params;
  const newData = { ...data };

  if (!newData.company_id) {
    return params;
  }

  const { data: company } = await dataProvider.getOne("companies", {
    id: newData.company_id,
  });

  if (!company) {
    return params;
  }

  newData.company_name = company.name;
  return { ...params, data: newData };
}

// Validates the Offer/Cohort relationship and snapshots commercial info onto
// the Opportunity, mirroring the Postgres trigger `handle_deal_saved()`
// (supabase/schemas/02_functions.sql) so demo mode enforces the same rule as
// production. Returns the data to save, with snapshot fields filled in.
async function applyDealOfferCohortSnapshot(
  data: Partial<Deal>,
  previousData: Deal | undefined,
  dataProvider: DataProvider,
): Promise<Partial<Deal>> {
  const offerId = data.offer_id ?? previousData?.offer_id;
  if (offerId == null) {
    return data;
  }

  const { data: offer } = await dataProvider.getOne<Offer>("offers", {
    id: offerId,
  });
  if (!offer) {
    throw new Error(`Invalid offer_id ${offerId}`);
  }

  const cohortId =
    data.cohort_id !== undefined ? data.cohort_id : previousData?.cohort_id;
  let cohort: Cohort | undefined;
  if (cohortId != null) {
    const { data: fetchedCohort } = await dataProvider.getOne<Cohort>(
      "cohorts",
      { id: cohortId },
    );
    if (!fetchedCohort) {
      throw new Error(`Invalid cohort_id ${cohortId}`);
    }
    cohort = fetchedCohort;
  }
  validateOfferCohort(offer, cohort ?? null);

  // Scholarship Pricing + Capacity slice: mirrors handle_deal_saved()'s own
  // guard/grant/release sequence exactly — see that function's comments
  // (supabase/schemas/02_functions.sql) for the full rationale.
  const isCreate = previousData === undefined;
  const nextPricingMode =
    data.pricing_mode ?? previousData?.pricing_mode ?? "standard";
  assertScholarshipGrantedOnlyViaEdit(isCreate, data.pricing_mode);
  if (!isCreate) {
    assertPricingModeImmutableOnceWon(
      previousData,
      data.pricing_mode,
      previousData!.id,
    );
    assertNoOfferChangeWhileScholarship(
      previousData,
      data.offer_id,
      previousData!.id,
    );
  }

  const pricingModeChanged =
    !isCreate &&
    data.pricing_mode != null &&
    data.pricing_mode !== previousData!.pricing_mode;
  if (pricingModeChanged) {
    if (data.pricing_mode === "scholarship") {
      if (offer.scholarship_price == null) {
        throw new Error(
          `Offer ${offer.id} has no scholarship price configured`,
        );
      }
      await claimScholarshipSlotForDeal(dataProvider, {
        offerId: offer.id,
        dealId: previousData!.id,
      });
    } else if (previousData!.pricing_mode === "scholarship") {
      await releaseScholarshipSlotForDeal(dataProvider, {
        offerId: previousData!.offer_id,
        dealId: previousData!.id,
      });
    }
  }

  const snapshot: Partial<Deal> = { ...data };
  const offerChanged =
    !previousData || String(previousData.offer_id) !== String(offer.id);
  if (offerChanged || pricingModeChanged) {
    snapshot.offer_name_snapshot = offer.name;
    snapshot.offer_price_snapshot =
      nextPricingMode === "scholarship"
        ? offer.scholarship_price
        : offer.current_price;
  }

  const paymentOptionChanged =
    data.selected_payment_option_id != null &&
    (!previousData ||
      String(previousData.selected_payment_option_id ?? "") !==
        String(data.selected_payment_option_id) ||
      pricingModeChanged);
  if (paymentOptionChanged) {
    const { data: paymentOption } =
      await dataProvider.getOne<OfferPaymentOption>("offer_payment_options", {
        id: data.selected_payment_option_id!,
      });
    if (paymentOption) {
      assertPaymentOptionMatchesPricingMode(
        paymentOption,
        offer.id,
        nextPricingMode ?? "standard",
        previousData?.id,
        data.selected_payment_option_id!,
      );
      snapshot.selected_payment_total = paymentOption.total;
      snapshot.selected_installment_count = paymentOption.installments;
      snapshot.selected_installment_amount = paymentOption.installment_amount;
    }
  }

  // The Opportunity's `name` is always derived from its Contact, never
  // user-typed (Programs + Opportunity UX slice, §1) — this is what makes
  // it structurally impossible for an Opportunity to display one person
  // while being linked to another.
  const contactId = data.contact_id ?? previousData?.contact_id;
  if (contactId != null) {
    const { data: contact } = await dataProvider.getOne<Contact>("contacts", {
      id: contactId,
    });
    if (contact) {
      snapshot.name = `${contact.first_name} ${contact.last_name}`.trim();
    }
  }

  return snapshot;
}

// Mirrors the Postgres trigger handle_waitlist_entry_saved() (Offer/Cohort
// consistency) plus the partial unique index waitlist_entries_active_
// unique_idx (duplicate-active prevention) — FakeRest has no constraint
// engine at all, so this hook is the *only* enforcement there (Waitlists
// slice, §4/§19).
async function validateWaitlistEntrySave(
  params: CreateParams<WaitlistEntry>,
  dataProvider: DataProvider,
): Promise<CreateParams<WaitlistEntry>>;
async function validateWaitlistEntrySave(
  params: UpdateParams<WaitlistEntry>,
  dataProvider: DataProvider,
): Promise<UpdateParams<WaitlistEntry>>;
async function validateWaitlistEntrySave(
  params: CreateParams<WaitlistEntry> | UpdateParams<WaitlistEntry>,
  dataProvider: DataProvider,
): Promise<CreateParams<WaitlistEntry> | UpdateParams<WaitlistEntry>> {
  const { data } = params;
  const previousData =
    "previousData" in params ? params.previousData : undefined;

  const offerId = data.offer_id ?? previousData?.offer_id;
  const cohortId =
    data.cohort_id !== undefined ? data.cohort_id : previousData?.cohort_id;

  if (offerId != null) {
    const { data: offer } = await dataProvider.getOne<Offer>("offers", {
      id: offerId,
    });
    if (!offer) {
      throw new Error(`Invalid offer_id ${offerId}`);
    }
    let cohort: Cohort | undefined;
    if (cohortId != null) {
      const { data: fetchedCohort } = await dataProvider.getOne<Cohort>(
        "cohorts",
        { id: cohortId },
      );
      if (!fetchedCohort) {
        throw new Error(`Invalid cohort_id ${cohortId}`);
      }
      cohort = fetchedCohort;
    }
    validateOfferCohort(offer, cohort ?? null);
  }

  const contactId = data.contact_id ?? previousData?.contact_id;
  const nextStatus = data.status ?? previousData?.status ?? "waiting";
  const identityChanged =
    !previousData ||
    String(previousData.contact_id) !== String(contactId) ||
    String(previousData.offer_id) !== String(offerId) ||
    String(previousData.cohort_id ?? "") !== String(cohortId ?? "");
  const becameActive =
    ACTIVE_WAITLIST_STATUSES.has(nextStatus) &&
    (identityChanged || !ACTIVE_WAITLIST_STATUSES.has(previousData!.status));

  if (becameActive && contactId != null && offerId != null) {
    await assertNoDuplicateActiveWaitlistEntry(dataProvider, {
      contactId,
      offerId,
      cohortId: cohortId ?? null,
    });
  }

  return params;
}

// Creates the Opportunity's Enrollment the moment it's genuinely Won, if one
// doesn't already exist. Mirrors the Postgres trigger `handle_deal_won()`.
// Idempotent: FakeRest calls are sequential/awaited so the check-then-create
// below can't race in demo mode; production's idempotency instead comes from
// the unique constraint on enrollments.opportunity_id (ON CONFLICT DO NOTHING).
async function ensureEnrollmentForWonDeal(
  deal: Deal,
  dataProvider: DataProvider,
): Promise<void> {
  if (deal.stage !== "won") return;

  const { total } = await dataProvider.getList<Enrollment>("enrollments", {
    filter: { opportunity_id: deal.id },
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
  });
  if ((total ?? 0) > 0) return;

  let cohort: Cohort | undefined;
  if (deal.cohort_id != null) {
    const { data } = await dataProvider.getOne<Cohort>("cohorts", {
      id: deal.cohort_id,
    });
    cohort = data;
  }

  const { data: enrollment } = await dataProvider.create<Enrollment>(
    "enrollments",
    {
      data: {
        opportunity_id: deal.id,
        status: "onboarding",
        start_date: cohort?.program_start_at?.split("T")[0] ?? null,
        end_date: cohort?.program_end_at?.split("T")[0] ?? null,
      },
    },
  );

  await seedOnboardingChecklistForEnrollment(dataProvider, deal, enrollment);

  // Scholarship Pricing + Capacity slice: atomically (in FakeRest's
  // sequential sense) hand the slot this Deal held over to its newly-
  // created Enrollment — mirrors handle_deal_won()'s own transition,
  // inside the same "genuine Won transition" gate this whole function is
  // already scoped to.
  if (deal.pricing_mode === "scholarship") {
    await transitionScholarshipSlotToEnrollment(dataProvider, {
      offerId: deal.offer_id,
      dealId: deal.id,
      enrollmentId: enrollment.id,
    });
  }
}

// Contracts + Onboarding slice: mirrors set_task_enrollment_id_consistency()
// exactly — a Task pointing at onboarding_item_id must always also point
// at that item's own enrollment_id (auto-filled when omitted, rejected
// when it mismatches) so Task -> Enrollment navigation stays deterministic
// rather than trusting every future write to get both fields right by
// hand. Client Offboarding slice: extended with the identical check for
// offboarding_item_id.
async function applyTaskEnrollmentConsistency(
  data: Partial<Task>,
  dataProvider: DataProvider,
): Promise<Partial<Task>> {
  let next = data;

  if (next.onboarding_item_id != null) {
    const item = await dataProvider
      .getOne<EnrollmentOnboardingItem>("enrollment_onboarding_items", {
        id: next.onboarding_item_id,
      })
      .then(({ data }) => data)
      .catch(() => null);
    if (!item) {
      throw new Error(`Invalid onboarding_item_id ${next.onboarding_item_id}`);
    }
    if (next.enrollment_id == null) {
      next = { ...next, enrollment_id: item.enrollment_id };
    } else if (String(next.enrollment_id) !== String(item.enrollment_id)) {
      throw new Error(
        `enrollment_id ${next.enrollment_id} does not match onboarding_item_id ${next.onboarding_item_id}'s own enrollment_id ${item.enrollment_id}`,
      );
    }
  }

  if (next.offboarding_item_id != null) {
    const item = await dataProvider
      .getOne<EnrollmentOffboardingItem>("enrollment_offboarding_items", {
        id: next.offboarding_item_id,
      })
      .then(({ data }) => data)
      .catch(() => null);
    if (!item) {
      throw new Error(
        `Invalid offboarding_item_id ${next.offboarding_item_id}`,
      );
    }
    if (next.enrollment_id == null) {
      next = { ...next, enrollment_id: item.enrollment_id };
    } else if (String(next.enrollment_id) !== String(item.enrollment_id)) {
      throw new Error(
        `enrollment_id ${next.enrollment_id} does not match offboarding_item_id ${next.offboarding_item_id}'s own enrollment_id ${item.enrollment_id}`,
      );
    }
  }

  return next;
}

// Contracts + Onboarding slice: mirrors handle_deal_won()'s own checklist
// + Task seeding exactly — snapshots the currently-active requirement
// templates for this Deal's Offer onto the new Enrollment, one Task per
// REQUIRED item only. Called exactly once, right after the Enrollment
// itself is created above, so it inherits that same idempotency.
async function seedOnboardingChecklistForEnrollment(
  dataProvider: DataProvider,
  deal: Deal,
  enrollment: Enrollment,
): Promise<void> {
  const { data: templates } =
    await dataProvider.getList<OnboardingRequirementTemplate>(
      "onboarding_requirement_templates",
      {
        filter: { offer_id: deal.offer_id, is_active: true },
        pagination: { page: 1, perPage: 50 },
        sort: { field: "sort_order", order: "ASC" },
      },
    );
  if (templates.length === 0) return;

  let contactName = deal.name;
  if (deal.contact_id != null) {
    const contact = await dataProvider
      .getOne<Contact>("contacts", { id: deal.contact_id })
      .then(({ data }) => data)
      .catch(() => null);
    const name =
      `${contact?.first_name ?? ""} ${contact?.last_name ?? ""}`.trim();
    if (name) contactName = name;
  }

  for (const template of templates) {
    const { data: item } = await dataProvider.create<EnrollmentOnboardingItem>(
      "enrollment_onboarding_items",
      {
        data: {
          enrollment_id: enrollment.id,
          requirement_key: template.key,
          label: template.label,
          task_text_template: template.task_text_template,
          is_required: template.is_required,
          sort_order: template.sort_order,
          status: "pending",
          completed_at: null,
          external_ref: null,
        },
      },
    );

    if (template.is_required) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      await dataProvider.create("tasks", {
        data: {
          contact_id: deal.contact_id,
          type: "onboarding_item",
          text: template.task_text_template.replace("{name}", contactName),
          due_date: dueDate.toISOString(),
          status: "pending",
          enrollment_id: enrollment.id,
          onboarding_item_id: item.id,
        },
      });
    }
  }
}

// Client Offboarding slice: mirrors
// handle_enrollment_offboarding_started()'s own checklist + Task seeding
// exactly — snapshots the currently-active offboarding requirement
// templates for this Enrollment's Offer, one Task per REQUIRED item
// only. Called exactly once, from the "enrollments" resource's own
// afterUpdate hook below, the moment status genuinely transitions
// active -> offboarding — same idempotency gate as
// seedOnboardingChecklistForEnrollment (that hook only fires on the exact
// transition, so a re-save while already offboarding never re-seeds).
// Zero configured templates for this Offer is a valid, explicit state
// (§5) — returns early, seeding nothing, rather than manufacturing a
// fake requirement.
async function seedOffboardingChecklistForEnrollment(
  dataProvider: DataProvider,
  deal: Deal,
  enrollment: Enrollment,
): Promise<void> {
  const { data: templates } =
    await dataProvider.getList<OffboardingRequirementTemplate>(
      "offboarding_requirement_templates",
      {
        filter: { offer_id: deal.offer_id, is_active: true },
        pagination: { page: 1, perPage: 50 },
        sort: { field: "sort_order", order: "ASC" },
      },
    );
  if (templates.length === 0) return;

  let contactName = deal.name;
  if (deal.contact_id != null) {
    const contact = await dataProvider
      .getOne<Contact>("contacts", { id: deal.contact_id })
      .then(({ data }) => data)
      .catch(() => null);
    const name =
      `${contact?.first_name ?? ""} ${contact?.last_name ?? ""}`.trim();
    if (name) contactName = name;
  }

  for (const template of templates) {
    const { data: item } = await dataProvider.create<EnrollmentOffboardingItem>(
      "enrollment_offboarding_items",
      {
        data: {
          enrollment_id: enrollment.id,
          requirement_key: template.key,
          label: template.label,
          task_text_template: template.task_text_template,
          is_required: template.is_required,
          sort_order: template.sort_order,
          status: "pending",
          completed_at: null,
          external_ref: null,
        },
      },
    );

    if (template.is_required) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      await dataProvider.create("tasks", {
        data: {
          contact_id: deal.contact_id,
          type: "offboarding_item",
          text: template.task_text_template.replace("{name}", contactName),
          due_date: dueDate.toISOString(),
          status: "pending",
          enrollment_id: enrollment.id,
          offboarding_item_id: item.id,
        },
      });
    }
  }
}

export interface CreateFakeRestDataProviderOptions {
  db?: Db;
  latency?: number;
  authProvider?: Pick<typeof defaultAuthProvider, "getIdentity">;
  silent?: boolean;
}

const processConfigLogo = async (logo: any): Promise<string> => {
  if (typeof logo === "string") return logo;
  if (logo?.rawFile instanceof File) {
    return (await convertFileToBase64(logo)) as string;
  }
  return logo?.src ?? "";
};

const preserveAttachmentMimeType = <
  NoteType extends { attachments?: Array<{ rawFile?: File; type?: string }> },
>(
  note: NoteType,
): NoteType => ({
  ...note,
  attachments: (note.attachments ?? []).map((attachment) => ({
    ...attachment,
    type: attachment.type ?? attachment.rawFile?.type,
  })),
});

export const createDataProvider = ({
  db = generateData(),
  latency = 300,
  authProvider,
  silent = false,
}: CreateFakeRestDataProviderOptions = {}): CrmDataProvider => {
  const baseDataProvider = fakeRestDataProvider(db, !silent, latency);
  let taskUpdateType = TASK_DONE_NOT_CHANGED;
  // Client Offboarding slice: afterUpdate's own UpdateResult carries no
  // previousData (unlike beforeUpdate's UpdateParams) — same
  // closure-variable shape as taskUpdateType above, set in beforeUpdate,
  // read in afterUpdate, safe because FakeRest calls are sequential/
  // awaited per request (never concurrent within one dataProvider
  // instance).
  let enrollmentPreviousStatus: Enrollment["status"] | undefined;
  const getIdentity = async () =>
    authProvider?.getIdentity?.() ?? defaultAuthProvider.getIdentity?.();

  const updateCompany = async (
    companyId: Identifier,
    updateFn: (company: Company) => Partial<Company>,
  ) => {
    const { data: company } = await dataProvider.getOne<Company>("companies", {
      id: companyId,
    });

    return await dataProvider.update("companies", {
      id: companyId,
      data: {
        ...updateFn(company),
      },
      previousData: company,
    });
  };

  const dataProviderWithCustomMethod: CrmDataProvider = {
    ...baseDataProvider,
    async getList(resource: string, params: any) {
      if (resource === "activity_log") {
        const { filter = {}, pagination } = params;
        const all = await getActivityLog(
          withSupabaseFilterAdapter(baseDataProvider),
          filter.company_id,
          filter.sales_id,
        );
        const { page, perPage } = pagination;
        const start = (page - 1) * perPage;
        return { data: all.slice(start, start + perPage), total: all.length };
      }
      if (resource === "contacts") {
        // Recompute the derived relationship fields (Contacts UX cleanup
        // pass) against the CURRENT live data before this read — see
        // contactRelationshipFields.ts's own header for why this can't be
        // done by mutating `db` directly (ra-data-fakerest deep-clones on
        // construction) or through the hook-wrapped `dataProvider`.
        await syncContactRelationshipFields(baseDataProvider);
      }
      return baseDataProvider.getList(resource, params);
    },
    unarchiveDeal: async (deal: Deal) => {
      // get all deals where stage is the same as the deal to unarchive
      const { data: deals } = await baseDataProvider.getList<Deal>("deals", {
        filter: { stage: deal.stage },
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "index", order: "ASC" },
      });

      // set index for each deal starting from 1, if the deal to unarchive is found, set its index to the last one
      const updatedDeals = deals.map((d, index) => ({
        ...d,
        index: d.id === deal.id ? 0 : index + 1,
        archived_at: d.id === deal.id ? null : d.archived_at,
      }));

      return await Promise.all(
        updatedDeals.map((updatedDeal) =>
          dataProvider.update("deals", {
            id: updatedDeal.id,
            data: updatedDeal,
            previousData: deals.find((d) => d.id === updatedDeal.id),
          }),
        ),
      );
    },
    signUp: async ({
      email,
      password,
      first_name,
      last_name,
    }: SignUpData): Promise<{
      id: string;
      email: string;
      password: string;
    }> => {
      const user = await baseDataProvider.create("sales", {
        data: {
          email,
          first_name,
          last_name,
        },
      });

      return {
        ...user.data,
        password,
      };
    },
    salesCreate: async ({ ...data }: SalesFormData): Promise<Sale> => {
      const response = await dataProvider.create("sales", {
        data: {
          ...data,
          password: "new_password",
        },
      });

      return response.data;
    },
    salesUpdate: async (
      id: Identifier,
      data: Partial<Omit<SalesFormData, "password">>,
    ): Promise<Sale> => {
      const { data: previousData } = await dataProvider.getOne<Sale>("sales", {
        id,
      });

      if (!previousData) {
        throw new Error("User not found");
      }

      const { data: sale } = await dataProvider.update<Sale>("sales", {
        id,
        data,
        previousData,
      });
      return { ...sale, user_id: sale.id.toString() };
    },
    isInitialized: async (): Promise<boolean> => {
      const sales = await dataProvider.getList<Sale>("sales", {
        filter: {},
        pagination: { page: 1, perPage: 1 },
        sort: { field: "id", order: "ASC" },
      });
      if (sales.data.length === 0) {
        return false;
      }
      return true;
    },
    updatePassword: async (id: Identifier): Promise<true> => {
      const currentUser = await getIdentity();
      if (!currentUser) {
        throw new Error("User not found");
      }
      const { data: previousData } = await dataProvider.getOne<Sale>("sales", {
        id: currentUser.id,
      });

      if (!previousData) {
        throw new Error("User not found");
      }

      await dataProvider.update("sales", {
        id,
        data: {
          password: "demo_newPassword",
        },
        previousData,
      });

      return true;
    },
    mergeContacts: async (sourceId: Identifier, targetId: Identifier) => {
      return mergeContacts(sourceId, targetId, baseDataProvider);
    },
    getConfiguration: async (): Promise<ConfigurationContextValue> => {
      const { data } = await baseDataProvider.getOne("configuration", {
        id: 1,
      });
      return (data?.config as ConfigurationContextValue) ?? {};
    },
    updateConfiguration: async (
      config: ConfigurationContextValue,
    ): Promise<ConfigurationContextValue> => {
      const { data: prev } = await baseDataProvider.getOne("configuration", {
        id: 1,
      });
      await baseDataProvider.update("configuration", {
        id: 1,
        data: { config },
        previousData: prev,
      });
      return config;
    },
  };

  const dataProvider = withLifecycleCallbacks(
    withSupabaseFilterAdapter(dataProviderWithCustomMethod),
    [
      {
        resource: "configuration",
        beforeUpdate: async (params) => {
          const config = params.data.config;
          if (config) {
            config.lightModeLogo = await processConfigLogo(
              config.lightModeLogo,
            );
            config.darkModeLogo = await processConfigLogo(config.darkModeLogo);
          }
          return params;
        },
      },
      {
        resource: "sales",
        beforeCreate: async (params) => {
          const { data } = params;
          // If administrator role is not set, we simply set it to false
          if (data.administrator == null) {
            data.administrator = false;
          }
          return params;
        },
        afterSave: async (data) => {
          // Since the current user is stored in localStorage in fakerest authProvider
          // we need to update it to keep information up to date in the UI
          const currentUser = await getIdentity();
          if (currentUser?.id === data.id) {
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data));
          }
          return data;
        },
        beforeDelete: async (params) => {
          if (params.meta?.identity?.id == null) {
            throw new Error("Identity MUST be set in meta");
          }

          const newSaleId = params.meta.identity.id as Identifier;

          const [companies, contacts, contactNotes, deals] = await Promise.all([
            dataProvider.getList("companies", {
              filter: { sales_id: params.id },
              pagination: {
                page: 1,
                perPage: 10_000,
              },
              sort: { field: "id", order: "ASC" },
            }),
            dataProvider.getList("contacts", {
              filter: { sales_id: params.id },
              pagination: {
                page: 1,
                perPage: 10_000,
              },
              sort: { field: "id", order: "ASC" },
            }),
            dataProvider.getList("contact_notes", {
              filter: { sales_id: params.id },
              pagination: {
                page: 1,
                perPage: 10_000,
              },
              sort: { field: "id", order: "ASC" },
            }),
            dataProvider.getList("deals", {
              filter: { sales_id: params.id },
              pagination: {
                page: 1,
                perPage: 10_000,
              },
              sort: { field: "id", order: "ASC" },
            }),
          ]);

          await Promise.all([
            dataProvider.updateMany("companies", {
              ids: companies.data.map((company) => company.id),
              data: {
                sales_id: newSaleId,
              },
            }),
            dataProvider.updateMany("contacts", {
              ids: contacts.data.map((company) => company.id),
              data: {
                sales_id: newSaleId,
              },
            }),
            dataProvider.updateMany("contact_notes", {
              ids: contactNotes.data.map((company) => company.id),
              data: {
                sales_id: newSaleId,
              },
            }),
            dataProvider.updateMany("deals", {
              ids: deals.data.map((company) => company.id),
              data: {
                sales_id: newSaleId,
              },
            }),
          ]);

          return params;
        },
      } satisfies ResourceCallbacks<Sale>,
      {
        resource: "contacts",
        beforeCreate: async (createParams, dataProvider) => {
          const params = {
            ...createParams,
            data: {
              ...createParams.data,
              first_seen:
                createParams.data.first_seen ?? new Date().toISOString(),
              last_seen:
                createParams.data.last_seen ?? new Date().toISOString(),
            },
          };
          const newParams = await processContactAvatar(params);
          return fetchAndUpdateCompanyData(newParams, dataProvider);
        },
        afterCreate: async (result) => {
          if (result.data.company_id != null) {
            await updateCompany(result.data.company_id, (company) => ({
              nb_contacts: (company.nb_contacts ?? 0) + 1,
            }));
          }

          return result;
        },
        beforeUpdate: async (params) => {
          const newParams = await processContactAvatar(params);
          return fetchAndUpdateCompanyData(newParams, dataProvider);
        },
        afterDelete: async (result) => {
          if (result.data.company_id != null) {
            await updateCompany(result.data.company_id, (company) => ({
              nb_contacts: (company.nb_contacts ?? 1) - 1,
            }));
          }

          return result;
        },
      } satisfies ResourceCallbacks<Contact>,
      {
        resource: "tasks",
        beforeCreate: async (params, dataProvider) => ({
          ...params,
          data: await applyTaskEnrollmentConsistency(params.data, dataProvider),
        }),
        afterCreate: async (result, dataProvider) => {
          // update the task count in the related contact
          const { contact_id } = result.data;
          const { data: contact } = await dataProvider.getOne("contacts", {
            id: contact_id,
          });
          await dataProvider.update("contacts", {
            id: contact_id,
            data: {
              nb_tasks: (contact.nb_tasks ?? 0) + 1,
            },
            previousData: contact,
          });
          return result;
        },
        beforeUpdate: async (params, dataProvider) => {
          const { data, previousData } = params;
          let nextData = await applyTaskEnrollmentConsistency(
            data,
            dataProvider,
          );
          if (previousData.done_date !== data.done_date) {
            taskUpdateType = data.done_date
              ? TASK_MARKED_AS_DONE
              : TASK_MARKED_AS_UNDONE;
            // Keep status in sync with the done_date checkbox: completing a
            // task marks it Completed; unchecking returns it to Pending
            // (Waiting/Cancelled are set explicitly via the task form, not
            // by this checkbox, so they're only touched here on the way
            // back to Pending).
            nextData = {
              ...nextData,
              status: data.done_date ? "completed" : "pending",
            };
          } else {
            taskUpdateType = TASK_DONE_NOT_CHANGED;
          }
          return { ...params, data: nextData };
        },
        afterUpdate: async (result, dataProvider) => {
          // update the contact: if the task is done, decrement the nb tasks, otherwise increment it
          const { contact_id } = result.data;
          const { data: contact } = await dataProvider.getOne("contacts", {
            id: contact_id,
          });
          if (taskUpdateType !== TASK_DONE_NOT_CHANGED) {
            await dataProvider.update("contacts", {
              id: contact_id,
              data: {
                nb_tasks:
                  taskUpdateType === TASK_MARKED_AS_DONE
                    ? (contact.nb_tasks ?? 0) - 1
                    : (contact.nb_tasks ?? 0) + 1,
              },
              previousData: contact,
            });

            // Contracts + Onboarding slice: mirrors
            // sync_onboarding_item_from_task() exactly — a Task pointing
            // at a specific checklist item has its done-ness mirrored onto
            // that item. Only fires on a genuine done_date change (the
            // outer `if` above), so a cancelled Task (status changes,
            // done_date does not) never touches the checklist — the
            // checklist stays the durable source of truth.
            if (result.data.onboarding_item_id != null) {
              const { data: item } = await dataProvider.getOne(
                "enrollment_onboarding_items",
                { id: result.data.onboarding_item_id },
              );
              if (
                taskUpdateType === TASK_MARKED_AS_DONE &&
                item.status !== "done"
              ) {
                await dataProvider.update("enrollment_onboarding_items", {
                  id: item.id,
                  data: {
                    status: "done",
                    completed_at: item.completed_at ?? result.data.done_date,
                  },
                  previousData: item,
                });
              } else if (
                taskUpdateType === TASK_MARKED_AS_UNDONE &&
                item.status === "done"
              ) {
                await dataProvider.update("enrollment_onboarding_items", {
                  id: item.id,
                  data: { status: "pending", completed_at: null },
                  previousData: item,
                });
              }
            }

            // Client Offboarding slice: mirrors
            // sync_offboarding_item_from_task() exactly — same reasoning
            // as the onboarding_item_id block above, scoped to
            // offboarding_item_id.
            if (result.data.offboarding_item_id != null) {
              const { data: item } = await dataProvider.getOne(
                "enrollment_offboarding_items",
                { id: result.data.offboarding_item_id },
              );
              if (
                taskUpdateType === TASK_MARKED_AS_DONE &&
                item.status !== "done"
              ) {
                await dataProvider.update("enrollment_offboarding_items", {
                  id: item.id,
                  data: {
                    status: "done",
                    completed_at: item.completed_at ?? result.data.done_date,
                  },
                  previousData: item,
                });
              } else if (
                taskUpdateType === TASK_MARKED_AS_UNDONE &&
                item.status === "done"
              ) {
                await dataProvider.update("enrollment_offboarding_items", {
                  id: item.id,
                  data: { status: "pending", completed_at: null },
                  previousData: item,
                });
              }
            }
          }
          return result;
        },
        afterDelete: async (result, dataProvider) => {
          // update the task count in the related contact
          const { contact_id } = result.data;
          const { data: contact } = await dataProvider.getOne("contacts", {
            id: contact_id,
          });
          await dataProvider.update("contacts", {
            id: contact_id,
            data: {
              nb_tasks: (contact.nb_tasks ?? 0) - 1,
            },
            previousData: contact,
          });
          return result;
        },
      } satisfies ResourceCallbacks<Task>,
      {
        resource: "enrollments",
        beforeUpdate: async (params, dataProvider) => {
          // afterUpdate's own result carries no previousData — capture it
          // here (see enrollmentPreviousStatus's own declaration comment).
          enrollmentPreviousStatus = params.previousData.status;

          // Client Offboarding slice, §1: mirrors
          // enforce_enrollment_lifecycle_sequence() exactly — a guarded
          // domain function (activateEnrollment.ts/startOffboarding.ts/
          // completeClient.ts) can never produce a skip since each only
          // accepts one specific FROM status, but a direct ClientEdit.tsx
          // write could otherwise jump straight from onboarding to
          // offboarding/completed, or active to completed. Backward
          // corrections stay ungated, same precedent as the two
          // narrower guards below.
          if (
            params.data.status != null &&
            params.data.status !== params.previousData.status
          ) {
            const rank: Record<string, number> = {
              onboarding: 0,
              active: 1,
              offboarding: 2,
              completed: 3,
            };
            const oldRank = rank[params.previousData.status];
            const newRank = rank[params.data.status];
            if (newRank > oldRank + 1) {
              throw new Error(
                `Cannot transition enrollment ${params.id} directly from ${params.previousData.status} to ${params.data.status} — the fulfillment lifecycle (onboarding -> active -> offboarding -> completed) cannot skip a stage`,
              );
            }
          }
          // Contracts + Onboarding slice: mirrors
          // enforce_enrollment_activation_requirements() exactly — the
          // DB-level guard against activating an Enrollment with
          // incomplete required onboarding, closing the gap left by
          // ClientEdit.tsx's plain status field. Only guards the
          // onboarding -> active direction; a manual correction back to
          // onboarding stays ungated.
          if (
            params.data.status === "active" &&
            params.previousData.status === "onboarding"
          ) {
            const { data: items } = await dataProvider.getList(
              "enrollment_onboarding_items",
              {
                filter: { enrollment_id: params.id },
                pagination: { page: 1, perPage: 100 },
                sort: { field: "id", order: "ASC" },
              },
            );
            const incomplete = items.some(
              (item) => item.is_required && item.status !== "done",
            );
            if (incomplete) {
              throw new Error(
                `Cannot activate enrollment ${params.id}: required onboarding items incomplete`,
              );
            }
          }
          // Client Offboarding slice: mirrors
          // enforce_enrollment_completion_requirements() exactly — same
          // gap-closing reasoning as the activation guard above. Only
          // guards the offboarding -> completed direction; a manual
          // correction back to offboarding stays ungated.
          if (
            params.data.status === "completed" &&
            params.previousData.status === "offboarding"
          ) {
            const { data: items } = await dataProvider.getList(
              "enrollment_offboarding_items",
              {
                filter: { enrollment_id: params.id },
                pagination: { page: 1, perPage: 100 },
                sort: { field: "id", order: "ASC" },
              },
            );
            const incomplete = items.some(
              (item) => item.is_required && item.status !== "done",
            );
            if (incomplete) {
              throw new Error(
                `Cannot complete enrollment ${params.id}: required offboarding items incomplete`,
              );
            }
          }

          // Scholarship Pricing + Capacity slice: mirrors
          // handle_enrollment_scholarship_slot_transition() exactly. Run in
          // beforeUpdate (not afterUpdate) — unlike a real Postgres AFTER
          // trigger, FakeRest has no transaction to abort once the
          // underlying write has already landed, so the reclaim-or-reject
          // decision must happen here, before that write, to genuinely
          // block a conflicting backward correction the same way the real
          // trigger does.
          if (
            params.data.status != null &&
            params.data.status !== params.previousData.status
          ) {
            if (params.data.status === "completed") {
              await releaseScholarshipSlotForEnrollment(dataProvider, {
                enrollmentId: params.id,
              });
            } else if (params.previousData.status === "completed") {
              const { data: deal } = await dataProvider.getOne<Deal>("deals", {
                id: params.previousData.opportunity_id,
              });
              if (deal.pricing_mode === "scholarship") {
                await reclaimScholarshipSlotForEnrollment(dataProvider, {
                  offerId: deal.offer_id,
                  enrollmentId: params.id,
                });
              }
            }
          }

          return params;
        },
        afterCreate: async (result, dataProvider) => {
          // Client Offboarding slice: mirrors
          // record_enrollment_status_event()'s own INSERT branch — the
          // smallest append-only audit trail for Enrollment lifecycle
          // transitions, recorded on every creation regardless of which
          // code path created it (ensureEnrollmentForWonDeal, or any
          // future path).
          await dataProvider.create("enrollment_status_events", {
            data: {
              enrollment_id: result.data.id,
              status: result.data.status,
              entered_at: new Date().toISOString(),
            },
          });
          return result;
        },
        afterUpdate: async (result, dataProvider) => {
          const { data: enrollment } = result;
          // Client Offboarding slice: mirrors
          // handle_enrollment_offboarding_started() exactly — fires only
          // on the genuine active -> offboarding transition, so a
          // duplicate "Start offboarding" write (already offboarding) is
          // a safe no-op, same idempotency gate as the real trigger.
          if (
            enrollment.status === "offboarding" &&
            enrollmentPreviousStatus === "active"
          ) {
            const { data: deal } = await dataProvider.getOne<Deal>("deals", {
              id: enrollment.opportunity_id,
            });
            await seedOffboardingChecklistForEnrollment(
              dataProvider,
              deal,
              enrollment,
            );
          }
          // Client Offboarding slice: mirrors
          // record_enrollment_status_event()'s own UPDATE branch — only a
          // genuine status change is recorded, never an unrelated field
          // edit (e.g. adjusting start_date/end_date).
          if (enrollmentPreviousStatus !== enrollment.status) {
            await dataProvider.create("enrollment_status_events", {
              data: {
                enrollment_id: enrollment.id,
                status: enrollment.status,
                entered_at: new Date().toISOString(),
              },
            });
          }
          return result;
        },
      } satisfies ResourceCallbacks<Enrollment>,
      {
        resource: "companies",
        beforeCreate: async (params) => {
          const createParams = await processCompanyLogo(params);

          return {
            ...createParams,
            data: {
              ...createParams.data,
              created_at: new Date().toISOString(),
            },
          };
        },
        beforeUpdate: async (params) => {
          return await processCompanyLogo(params);
        },
        afterUpdate: async (result, dataProvider) => {
          // get all contacts of the company and for each contact, update the company_name
          const { id, name } = result.data;
          const { data: contacts } = await dataProvider.getList("contacts", {
            filter: { company_id: id },
            pagination: { page: 1, perPage: 1000 },
            sort: { field: "id", order: "ASC" },
          });

          const contactIds = contacts.map((contact) => contact.id);
          await dataProvider.updateMany("contacts", {
            ids: contactIds,
            data: { company_name: name },
          });
          return result;
        },
      } satisfies ResourceCallbacks<Company>,
      {
        resource: "deals",
        beforeCreate: async (params, dataProvider) => {
          const data = await applyDealOfferCohortSnapshot(
            params.data,
            undefined,
            dataProvider,
          );
          return {
            ...params,
            data: {
              // Mirrors the DB column default — every other pricing_mode
              // branch above already assumes this is always populated.
              pricing_mode: "standard",
              ...data,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              // Kanban queue-ordering slice: mirrors the Postgres BEFORE
              // trigger set_deal_stage_entered_at() — an insert is always a
              // genuine stage entry.
              stage_entered_at: new Date().toISOString(),
            },
          };
        },
        afterCreate: async (result, dataProvider) => {
          // Opportunities no longer link to a company by default (Leif's
          // model has no B2B layer); only bump the count when one is set.
          if (result.data.company_id != null) {
            await updateCompany(result.data.company_id, (company) => ({
              nb_deals: (company.nb_deals ?? 0) + 1,
            }));
          }

          // A deal can be created directly as Won (e.g. an import); make
          // sure it gets its Enrollment too.
          await ensureEnrollmentForWonDeal(result.data, dataProvider);

          // Human-acceptance repair pass, §4: creating ANY active
          // Opportunity (New Opportunity, an Application, a future
          // integration) converts any compatible Waitlist Entry — the one
          // centralized place, see waitlist/waitlistSync.ts.
          await syncWaitlistForActiveDeal(result.data, dataProvider);

          // Kanban queue-ordering slice: permanent history row for the
          // stage this Opportunity was created into.
          await ensureDealStageEvent(dataProvider, result.data);

          return result;
        },
        beforeUpdate: async (params, dataProvider) => {
          const data = await applyDealOfferCohortSnapshot(
            params.data,
            params.previousData,
            dataProvider,
          );
          // Kanban queue-ordering slice: mirrors the Postgres BEFORE
          // trigger set_deal_stage_entered_at() exactly — stamp
          // stage_entered_at only when `stage` is genuinely changing (every
          // real stage-changing pathway — Application review, sales-call
          // booking/outcomes, Kanban drag/drop — writes `data.stage` through
          // this one shared "deals" update hook, so none of them can bypass
          // this). An unrelated field edit, a note, or a same-stage index
          // reorder never sets `data.stage`, so it never touches this.
          const stageChanged =
            data.stage !== undefined &&
            data.stage !== params.previousData.stage;
          return {
            ...params,
            data: {
              ...data,
              updated_at: new Date().toISOString(),
              ...(stageChanged
                ? { stage_entered_at: new Date().toISOString() }
                : {}),
            },
          };
        },
        afterUpdate: async (result, dataProvider) => {
          await ensureEnrollmentForWonDeal(result.data, dataProvider);
          // Covers every stage/outcome change made anywhere — Application
          // approval (reviewApplication.ts), Kanban drag-and-drop
          // (DealListContent.tsx), a manual Edit — since they all write
          // through this one dataProvider.update("deals", ...) call.
          await syncWaitlistForActiveDeal(result.data, dataProvider);
          // Kanban queue-ordering slice: same centralization — appends a
          // deal_stage_events row only when stage_entered_at just changed
          // (ensureDealStageEvent is idempotent, so this is a no-op for
          // every unrelated update).
          await ensureDealStageEvent(dataProvider, result.data);
          return result;
        },
        afterDelete: async (result) => {
          if (result.data.company_id != null) {
            await updateCompany(result.data.company_id, (company) => ({
              nb_deals: (company.nb_deals ?? 1) - 1,
            }));
          }

          return result;
        },
      } satisfies ResourceCallbacks<Deal>,
      {
        resource: "waitlist_entries",
        beforeCreate: validateWaitlistEntrySave,
        beforeUpdate: validateWaitlistEntrySave,
      } satisfies ResourceCallbacks<WaitlistEntry>,
      {
        // Mirrors the Postgres trigger sync_deal_sales_call_at() (afterX
        // hooks) and the real DB's partial unique index (beforeX hooks) —
        // keeps deals.sales_call_at synchronized with sales_calls on every
        // write, and enforces "at most one booked call per Opportunity"
        // (FakeRest has no constraint engine, see salesCallValidation.ts).
        resource: "sales_calls",
        beforeCreate: async (params, dataProvider) => {
          await assertNoDuplicateBookedSalesCall(dataProvider, {
            opportunityId: params.data.opportunity_id,
          });
          return params;
        },
        beforeUpdate: async (params, dataProvider) => {
          const nextStatus = params.data.status ?? params.previousData.status;
          if (nextStatus === "booked") {
            const opportunityId =
              params.data.opportunity_id !== undefined
                ? params.data.opportunity_id
                : params.previousData.opportunity_id;
            await assertNoDuplicateBookedSalesCall(dataProvider, {
              opportunityId,
              excludeSalesCallId: params.previousData.id,
            });
          }
          return params;
        },
        afterCreate: async (result, dataProvider) => {
          if (result.data.opportunity_id != null) {
            await syncDealSalesCallAt(dataProvider, result.data.opportunity_id);
          }
          return result;
        },
        afterUpdate: async (result, dataProvider) => {
          if (result.data.opportunity_id != null) {
            await syncDealSalesCallAt(dataProvider, result.data.opportunity_id);
          }
          return result;
        },
        afterDelete: async (result, dataProvider) => {
          if (result.data.opportunity_id != null) {
            await syncDealSalesCallAt(dataProvider, result.data.opportunity_id);
          }
          return result;
        },
      } satisfies ResourceCallbacks<SalesCall>,
      {
        resource: "contact_notes",
        beforeSave: async (params) => preserveAttachmentMimeType(params),
      } satisfies ResourceCallbacks<ContactNote>,
      {
        resource: "deal_notes",
        beforeSave: async (params) => preserveAttachmentMimeType(params),
      } satisfies ResourceCallbacks<DealNote>,
    ],
  ) as CrmDataProvider;

  return dataProvider;
};

export const dataProvider = createDataProvider();

/**
 * Convert a `File` object returned by the upload input into a base 64 string.
 * That's not the most optimized way to store images in production, but it's
 * enough to illustrate the idea of dataprovider decoration.
 */
const convertFileToBase64 = (file: { rawFile: Blob }): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    // We know result is a string as we used readAsDataURL
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file.rawFile);
  });
