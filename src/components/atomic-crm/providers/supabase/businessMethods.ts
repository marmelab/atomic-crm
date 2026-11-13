import { HttpError } from "ra-core";

import type {
  Business,
  BusinessMember,
  BusinessRole,
  CountryPack,
  NewBusiness,
  Requisites,
  RequisiteField,
} from "../../business/types";
import { clearCache, getCurrentBusinessId } from "./authProvider";
import { getSupabaseClient } from "./supabase";

const fail = (message: string, error: { message?: string; code?: string }) => {
  throw new HttpError(error.message ?? message, 400, error);
};

/**
 * Businesses, their country packs and their members: the data behind the
 * setup wizard and the business settings page.
 */
export const businessMethods = {
  async getCountryPacks(): Promise<CountryPack[]> {
    const { data, error } = await getSupabaseClient()
      .from("country_packs")
      .select("code, name, language, locale, currency, timezone")
      .eq("is_active", true)
      .order("code", { ascending: false });
    if (error) fail("Failed to load the countries", error);
    return (data ?? []) as CountryPack[];
  },

  async getRequisiteFields(countryCode: string): Promise<RequisiteField[]> {
    const { data, error } = await getSupabaseClient().rpc(
      "active_requisite_fields",
      { p_country_code: countryCode },
    );
    if (error) fail("Failed to load the requisites", error);
    return (data ?? []) as RequisiteField[];
  },

  async getMissingRequisites(
    countryCode: string,
    requisites: Requisites,
  ): Promise<string[]> {
    const { data, error } = await getSupabaseClient().rpc(
      "missing_requisites",
      { p_country_code: countryCode, p_requisites: requisites },
    );
    if (error) fail("Failed to check the requisites", error);
    return (data ?? []) as string[];
  },

  /** Creates a business owned by the current user and makes it current. */
  async createBusiness(business: NewBusiness): Promise<string> {
    const { data, error } = await getSupabaseClient().rpc("create_business", {
      p_name: business.name,
      p_country_code: business.country_code,
      p_business_type: business.business_type,
      p_requisites: business.requisites,
    });
    if (error) fail("Failed to create the business", error);
    clearCache();
    return data as string;
  },

  /** The current business, or null when the user has none yet. */
  async getCurrentBusiness(): Promise<Business | null> {
    let businessId: string;
    try {
      businessId = await getCurrentBusinessId();
    } catch {
      return null;
    }
    const { data, error } = await getSupabaseClient()
      .from("businesses")
      .select(
        "id, name, country_code, business_type, requisites, currency, timezone, is_demo, country_packs(language)",
      )
      .eq("id", businessId)
      .maybeSingle();
    if (error) fail("Failed to load the business", error);
    if (!data) return null;
    const { country_packs, ...business } = data as unknown as Omit<
      Business,
      "language"
    > & { country_packs: { language: string } | null };
    return { ...business, language: country_packs?.language ?? null };
  },

  async updateBusiness(
    id: string,
    changes: Partial<Pick<Business, "name" | "business_type" | "requisites">>,
  ): Promise<void> {
    const { error } = await getSupabaseClient()
      .from("businesses")
      .update(changes)
      .eq("id", id);
    if (error) fail("Failed to save the business", error);
  },

  async getBusinessMembers(businessId: string): Promise<BusinessMember[]> {
    const { data: members, error } = await getSupabaseClient()
      .from("members")
      .select("user_id, role, disabled")
      .eq("business_id", businessId);
    if (error) fail("Failed to load the members", error);
    const userIds = (members ?? []).map((member) => member.user_id);
    if (userIds.length === 0) return [];
    const { data: people, error: peopleError } = await getSupabaseClient()
      .from("sales")
      .select("user_id, first_name, last_name, email")
      .in("user_id", userIds);
    if (peopleError) fail("Failed to load the members", peopleError);
    const byUser = new Map((people ?? []).map((p) => [p.user_id, p]));
    const { data: session } = await getSupabaseClient().auth.getSession();
    const myUserId = session?.session?.user.id;
    return (members ?? [])
      .map((member) => ({
        ...member,
        first_name: byUser.get(member.user_id)?.first_name ?? "",
        last_name: byUser.get(member.user_id)?.last_name ?? "",
        email: byUser.get(member.user_id)?.email ?? "",
        is_me: member.user_id === myUserId,
      }))
      .sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(
          `${b.first_name} ${b.last_name}`,
        ),
      ) as BusinessMember[];
  },

  async setMember(
    userId: string,
    changes: { role?: BusinessRole; disabled?: boolean },
  ): Promise<void> {
    const { error } = await getSupabaseClient().rpc("set_member", {
      p_user_id: userId,
      p_role: changes.role ?? null,
      p_disabled: changes.disabled ?? null,
    });
    if (error) fail("Failed to change the member", error);
    clearCache();
  },

  /** Deletes the business with all its data; the name confirms it. */
  async deleteBusiness(id: string, confirmName: string): Promise<void> {
    const { error } = await getSupabaseClient().rpc("delete_business", {
      p_business_id: id,
      p_confirm_name: confirmName,
    });
    if (error) fail("Failed to delete the business", error);
    clearCache();
  },
};
