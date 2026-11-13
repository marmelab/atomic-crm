import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import {
  type BusinessContext,
  type BusinessRole,
  getBusinessContext,
  isBusinessRole,
} from "../_shared/businessContext.ts";
import {
  findInvalidEmail,
  MAX_SECONDARY_EMAILS,
  normalizeSecondaryEmails,
} from "./secondaryEmails.ts";

// Users (sales) are people; what they can do depends on the business. Owners
// of the caller's current business invite people into it and change their
// role or access there. Profile fields (email, name, avatar) belong to the
// person and can only be changed by the person themselves: an owner of one
// business must not be able to take over the account of someone who also works
// in another business.

const jsonResponse = (data: unknown) =>
  new Response(JSON.stringify({ data }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

async function getMembership(businessId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("members")
    .select("role, disabled")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data as { role: BusinessRole; disabled: boolean } | null;
}

// The sale as seen from a business: administrator and disabled are per business.
async function getSaleInBusiness(salesId: number, businessId: string) {
  const { data: sale, error } = await supabaseAdmin
    .from("sales")
    .select("*")
    .eq("id", salesId)
    .single();
  if (error || !sale) {
    throw error ?? new Error("Sale not found");
  }
  const membership = await getMembership(businessId, sale.user_id);
  return {
    ...sale,
    administrator: membership?.role === "owner",
    disabled: membership?.disabled ?? true,
  };
}

// administrator=true makes an owner; administrator=false demotes an owner to
// manager and leaves other roles as they are. An explicit role wins.
const resolveRole = (
  current: BusinessRole | undefined,
  role: unknown,
  administrator: unknown,
): BusinessRole | undefined => {
  if (isBusinessRole(role)) return role;
  if (administrator === true) return "owner";
  if (administrator === false) {
    return current === undefined || current === "owner" ? "manager" : current;
  }
  return current;
};

async function updateMembership(
  businessId: string,
  userId: string,
  changes: { role?: BusinessRole; disabled?: boolean },
) {
  const { error } = await supabaseAdmin
    .from("members")
    .update(changes)
    .eq("business_id", businessId)
    .eq("user_id", userId);
  if (error) {
    throw error;
  }
}

async function findEmailUsedByAnotherSale(
  emails: string[],
  excludeSalesId?: number,
) {
  const isTakenBy = async (
    column: "email" | "secondary_emails",
    email: string,
  ) => {
    const selected = supabaseAdmin.from("sales").select("id");
    let query =
      column === "email"
        ? selected.eq("email", email)
        : selected.contains("secondary_emails", JSON.stringify([email]));

    if (excludeSalesId !== undefined) {
      query = query.neq("id", excludeSalesId);
    }

    const { data: matches, error: salesError } = await query.limit(1);

    if (salesError) {
      console.error("Error fetching sales:", salesError);
      throw salesError;
    }

    return Boolean(matches?.length);
  };

  for (const email of emails) {
    if (
      (await isTakenBy("email", email)) ||
      (await isTakenBy("secondary_emails", email))
    ) {
      return email;
    }
  }

  return undefined;
}

async function inviteUser(req: Request, context: BusinessContext) {
  const {
    email,
    password,
    first_name,
    last_name,
    disabled,
    administrator,
    role,
  } = await req.json();

  if (context.role !== "owner") {
    return createErrorResponse(401, "Not Authorized");
  }

  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalizedEmail) {
    return createErrorResponse(400, "Email is required");
  }
  const newRole = resolveRole(undefined, role, administrator) ?? "manager";

  // The person already has an account: add them to the business.
  const { data: existingSale, error: existingSaleError } = await supabaseAdmin
    .from("sales")
    .select("id, user_id")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (existingSaleError) {
    console.error("Error inviting user:", existingSaleError);
    return createErrorResponse(500, "Internal Server Error");
  }

  if (existingSale) {
    if (await getMembership(context.business_id, existingSale.user_id)) {
      return createErrorResponse(
        409,
        `Already a member of this business: ${normalizedEmail}`,
        { code: "already_member", email: normalizedEmail },
      );
    }
    const { error: memberError } = await supabaseAdmin.from("members").insert({
      business_id: context.business_id,
      user_id: existingSale.user_id,
      role: newRole,
      disabled: disabled === true,
    });
    if (memberError) {
      console.error("Error adding member:", memberError);
      return createErrorResponse(500, "Internal Server Error");
    }
    return jsonResponse(
      await getSaleInBusiness(existingSale.id, context.business_id),
    );
  }

  const takenEmail = await findEmailUsedByAnotherSale([normalizedEmail]);
  if (takenEmail) {
    return createErrorResponse(
      409,
      `Email already used by another user: ${takenEmail}`,
      { code: "email_taken", email: takenEmail },
    );
  }

  // New account: the invitation tells the sign-up trigger which business and
  // role the new user joins.
  const id = crypto.randomUUID();
  const { error: invitationError } = await supabaseAdmin
    .from("user_invitations")
    .insert({ user_id: id, business_id: context.business_id, role: newRole });

  if (invitationError) {
    console.error(`Error inviting user: invitation_error=${invitationError}`);
    return createErrorResponse(500, "Internal Server Error");
  }

  const { data, error: userError } = await supabaseAdmin.auth.admin.createUser({
    id,
    email: normalizedEmail,
    password,
    user_metadata: { first_name, last_name },
  });

  if (userError || !data?.user) {
    console.error(`Error inviting user: user_error=${userError}`);
    await supabaseAdmin.from("user_invitations").delete().eq("user_id", id);
    return createErrorResponse(
      userError?.status ?? 500,
      userError?.message ?? "Internal Server Error",
      { code: userError?.code },
    );
  }

  const { error: emailError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(normalizedEmail);
  if (emailError) {
    console.error(`Error inviting user, email_error=${emailError}`);
    return createErrorResponse(500, "Failed to send invitation mail");
  }

  try {
    if (disabled === true) {
      await updateMembership(context.business_id, data.user.id, {
        disabled: true,
      });
    }
    const sale = await getUserSale(data.user);
    return jsonResponse(await getSaleInBusiness(sale.id, context.business_id));
  } catch (e) {
    console.error("Error patching sale:", e);
    return createErrorResponse(500, "Internal Server Error");
  }
}

async function updateOwnProfile(
  sale: {
    id: number;
    user_id: string;
    email: string;
    secondary_emails: unknown;
  },
  body: {
    email?: string;
    secondary_emails?: unknown;
    first_name?: string;
    last_name?: string;
    avatar?: unknown;
  },
): Promise<Response | null> {
  const { email, secondary_emails, first_name, last_name, avatar } = body;

  if (email && email.trim().toLowerCase() !== sale.email.toLowerCase()) {
    const takenEmail = await findEmailUsedByAnotherSale(
      [email.trim().toLowerCase()],
      sale.id,
    );
    if (takenEmail) {
      return createErrorResponse(
        409,
        `Email already used by another user: ${takenEmail}`,
        { code: "email_taken", email: takenEmail },
      );
    }
  }

  let normalizedSecondaryEmails: string[] | undefined;
  if (secondary_emails !== undefined) {
    normalizedSecondaryEmails = normalizeSecondaryEmails(secondary_emails);
    if (!normalizedSecondaryEmails) {
      return createErrorResponse(400, "secondary_emails must be an array", {
        code: "invalid_secondary_emails_payload",
      });
    }

    if (normalizedSecondaryEmails.length > MAX_SECONDARY_EMAILS) {
      return createErrorResponse(
        400,
        `No more than ${MAX_SECONDARY_EMAILS} secondary emails are allowed`,
        { code: "too_many_secondary_emails" },
      );
    }

    const invalidEmail = findInvalidEmail(normalizedSecondaryEmails);
    if (invalidEmail) {
      return createErrorResponse(
        400,
        `Invalid secondary email: ${invalidEmail}`,
        { code: "invalid_secondary_email", email: invalidEmail },
      );
    }

    const takenEmail = await findEmailUsedByAnotherSale(
      normalizedSecondaryEmails,
      sale.id,
    );
    if (takenEmail) {
      return createErrorResponse(
        409,
        `Secondary email already used by another user: ${takenEmail}`,
        { code: "secondary_email_taken", email: takenEmail },
      );
    }
  }

  const primaryEmail = (email ?? sale.email).trim().toLowerCase();
  const effectiveSecondaryEmails =
    normalizedSecondaryEmails ??
    (Array.isArray(sale.secondary_emails) ? sale.secondary_emails : []);

  if (effectiveSecondaryEmails.includes(primaryEmail)) {
    return createErrorResponse(
      409,
      `Secondary email is already the main address: ${primaryEmail}`,
      { code: "secondary_email_is_primary", email: primaryEmail },
    );
  }

  const { data, error: userError } =
    await supabaseAdmin.auth.admin.updateUserById(sale.user_id, {
      email,
      user_metadata: { first_name, last_name },
    });

  if (!data?.user || userError) {
    console.error("Error patching user:", userError);
    return createErrorResponse(500, "Internal Server Error");
  }

  const profileChanges: Record<string, unknown> = {};
  if (avatar) profileChanges.avatar = avatar;
  if (normalizedSecondaryEmails) {
    profileChanges.secondary_emails = normalizedSecondaryEmails;
  }
  if (Object.keys(profileChanges).length > 0) {
    const { error } = await supabaseAdmin
      .from("sales")
      .update(profileChanges)
      .eq("user_id", sale.user_id);
    if (error) {
      console.error("Error patching sale:", error);
      return createErrorResponse(500, "Internal Server Error");
    }
  }

  return null;
}

async function patchUser(
  req: Request,
  currentUserSale: { id: number; user_id: string },
  context: BusinessContext,
) {
  const body = await req.json();
  const { sales_id, administrator, disabled, role } = body;

  const { data: sale } = await supabaseAdmin
    .from("sales")
    .select("*")
    .eq("id", sales_id)
    .single();

  if (!sale) {
    return createErrorResponse(404, "Not Found");
  }

  const isSelf = currentUserSale.id === sale.id;
  const isOwner = context.role === "owner";
  const membership = await getMembership(context.business_id, sale.user_id);

  // Only yourself, or a member of your current business if you own it
  if (!isSelf && !(isOwner && membership)) {
    return createErrorResponse(401, "Not Authorized");
  }

  if (isSelf) {
    const errorResponse = await updateOwnProfile(sale, body);
    if (errorResponse) {
      return errorResponse;
    }
  }

  if (isOwner && membership) {
    const changes: { role?: BusinessRole; disabled?: boolean } = {};
    const newRole = resolveRole(membership.role, role, administrator);
    if (newRole && newRole !== membership.role) changes.role = newRole;
    if (typeof disabled === "boolean" && disabled !== membership.disabled) {
      changes.disabled = disabled;
    }
    if (Object.keys(changes).length > 0) {
      try {
        await updateMembership(context.business_id, sale.user_id, changes);
      } catch (e) {
        // protect_last_owner: a business keeps at least one active owner
        if ((e as { code?: string }).code === "P0001") {
          return createErrorResponse(400, (e as Error).message, {
            code: "last_owner",
          });
        }
        console.error("Error updating member:", e);
        return createErrorResponse(500, "Internal Server Error");
      }
    }
  }

  return jsonResponse(await getSaleInBusiness(sale.id, context.business_id));
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user) => {
        const currentUserSale = await getUserSale(user);
        if (!currentUserSale) {
          return createErrorResponse(401, "Unauthorized");
        }

        try {
          const context = await getBusinessContext(user.id);
          if (!context) {
            return createErrorResponse(401, "Unauthorized");
          }

          if (req.method === "POST") {
            return await inviteUser(req, context);
          }

          if (req.method === "PATCH") {
            return await patchUser(req, currentUserSale, context);
          }
        } catch (e) {
          console.error("Unhandled error in the users function:", e);
          return createErrorResponse(500, "Internal Server Error");
        }

        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  ),
);
