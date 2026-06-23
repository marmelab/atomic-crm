import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse, createJsonResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import {
  errorResponseFromUnknown,
  getOptionalBooleanField,
  getOptionalStringField,
  getPositiveIntegerField,
  parseRequiredJsonBody,
} from "../_shared/http.ts";

async function updateSaleDisabled(user_id: string, disabled: boolean) {
  return await supabaseAdmin
    .from("sales")
    .update({ disabled: disabled ?? false })
    .eq("user_id", user_id);
}

async function updateSaleAdministrator(
  user_id: string,
  administrator: boolean,
) {
  const { data: sales, error: salesError } = await supabaseAdmin
    .from("sales")
    .update({ administrator })
    .eq("user_id", user_id)
    .select("*");

  if (!sales?.length || salesError) {
    console.error("Error updating user:", salesError);
    throw salesError ?? new Error("Failed to update sale");
  }
  return sales.at(0);
}

async function createSale(
  user_id: string,
  data: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    disabled: boolean;
    administrator: boolean;
  },
) {
  const { data: sales, error: salesError } = await supabaseAdmin
    .from("sales")
    .insert({ ...data, user_id })
    .select("*");

  if (!sales?.length || salesError) {
    console.error("Error creating user:", salesError);
    throw salesError ?? new Error("Failed to create sale");
  }
  return sales.at(0);
}

async function updateSaleAvatar(
  user_id: string,
  avatar: Record<string, unknown>,
) {
  const { data: sales, error: salesError } = await supabaseAdmin
    .from("sales")
    .update({ avatar })
    .eq("user_id", user_id)
    .select("*");

  if (!sales?.length || salesError) {
    console.error("Error updating user:", salesError);
    throw salesError ?? new Error("Failed to update sale");
  }
  return sales.at(0);
}

// --- Input validation helpers ---

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LENGTH = 100;

function isValidEmail(email: unknown): email is string {
  return (
    typeof email === "string" && EMAIL_REGEX.test(email) && email.length <= 254
  );
}

function isValidName(name: unknown): name is string {
  return (
    typeof name === "string" &&
    name.trim().length > 0 &&
    name.length <= MAX_NAME_LENGTH
  );
}

function buildAuthCallbackUrl() {
  const siteUrl = Deno.env.get("SITE_URL") ?? "https://crm.axonadigital.se";

  try {
    return new URL("/auth-callback.html", siteUrl).toString();
  } catch (error) {
    console.error("Invalid SITE_URL:", siteUrl, error);
    return "https://crm.axonadigital.se/auth-callback.html";
  }
}

function generateTemporaryPassword(length = 20) {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const randomBytes = crypto.getRandomValues(new Uint8Array(length));

  return Array.from(
    randomBytes,
    (value) => alphabet[value % alphabet.length],
  ).join("");
}

async function generateInviteLink(
  email: string,
  first_name: string,
  last_name: string,
) {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: { first_name, last_name },
      redirectTo: buildAuthCallbackUrl(),
    },
  });

  if (error) {
    console.error("generateLink(invite) error:", error);
    return null;
  }

  return data.properties?.action_link ?? null;
}

async function ensureAccessFallback(
  userId: string,
  email: string,
  first_name: string,
  last_name: string,
) {
  const inviteLink = await generateInviteLink(email, first_name, last_name);

  if (inviteLink) {
    return {
      invite_link: inviteLink,
      temporary_password: null,
    };
  }

  const temporaryPassword = generateTemporaryPassword();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: temporaryPassword,
    user_metadata: { first_name, last_name },
  });

  if (error) {
    console.error("updateUserById fallback password error:", error);
    return {
      invite_link: null,
      temporary_password: null,
    };
  }

  return {
    invite_link: null,
    temporary_password: temporaryPassword,
  };
}

// --- Route handlers ---

async function inviteUser(req: Request, currentUserSale: any) {
  try {
    const body = await parseRequiredJsonBody(req);
    const email = getOptionalStringField(body, "email");
    const first_name = getOptionalStringField(body, "first_name");
    const last_name = getOptionalStringField(body, "last_name");
    const disabled = getOptionalBooleanField(body, "disabled");
    const administrator = getOptionalBooleanField(body, "administrator");

    if (!currentUserSale.administrator) {
      return createErrorResponse(401, "Not Authorized");
    }

    if (!isValidEmail(email)) {
      return createErrorResponse(400, "Invalid or missing email address");
    }
    if (!isValidName(first_name)) {
      return createErrorResponse(
        400,
        "Invalid or missing first_name (max 100 chars)",
      );
    }
    if (!isValidName(last_name)) {
      return createErrorResponse(
        400,
        "Invalid or missing last_name (max 100 chars)",
      );
    }
    if (disabled === undefined) {
      return createErrorResponse(400, "disabled must be a boolean");
    }
    if (administrator === undefined) {
      return createErrorResponse(400, "administrator must be a boolean");
    }

    const redirectTo = buildAuthCallbackUrl();
    const { data, error: userError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { first_name, last_name },
        redirectTo,
      });

    let user = data?.user;
    let inviteLink: string | null = null;
    let temporaryPassword: string | null = null;

    if (!user && userError?.code === "email_exists") {
      // This may happen if users cleared their database but not the users
      // We have to create the sale directly
      const { data, error } = await supabaseAdmin.rpc("get_user_id_by_email", {
        email,
      });

      if (!data || error) {
        console.error(
          `Error inviting user: error=${error ?? "could not fetch users for email"}`,
        );
        return createErrorResponse(500, "Internal Server Error");
      }

      user = data[0];
      try {
        const { data: existingSale, error: salesError } = await supabaseAdmin
          .from("sales")
          .select("*")
          .eq("user_id", user.id);
        if (salesError) {
          return createErrorResponse(salesError.status, salesError.message, {
            code: salesError.code,
          });
        }
        if (existingSale.length > 0) {
          const fallback = await ensureAccessFallback(
            user.id,
            email,
            first_name,
            last_name,
          );
          return createJsonResponse({
            data: existingSale[0],
            invite_link: fallback.invite_link,
            temporary_password: fallback.temporary_password,
            existing_user: true,
          });
        }

        const sale = await createSale(user.id, {
          email,
          password: "", // Never store plaintext passwords in the sales table
          first_name,
          last_name,
          disabled,
          administrator,
        });

        const fallback = await ensureAccessFallback(
          user.id,
          email,
          first_name,
          last_name,
        );

        return createJsonResponse({
          data: sale,
          invite_link: fallback.invite_link,
          temporary_password: fallback.temporary_password,
        });
      } catch (error) {
        return createErrorResponse(
          (error as any).status ?? 500,
          (error as Error).message,
          {
            code: (error as any).code,
          },
        );
      }
    } else {
      if (userError) {
        console.error(`Error inviting user: user_error=${userError}`);
        return createErrorResponse(userError.status, userError.message, {
          code: userError.code,
        });
      }
      if (!data?.user) {
        console.error("Error inviting user: undefined user");
        return createErrorResponse(500, "Internal Server Error");
      }
      const fallback = await ensureAccessFallback(
        data.user.id,
        email,
        first_name,
        last_name,
      );
      inviteLink = fallback.invite_link;
      temporaryPassword = fallback.temporary_password;
    }

    try {
      await updateSaleDisabled(user.id, disabled);
      const sale = await updateSaleAdministrator(user.id, administrator);

      return createJsonResponse({
        data: sale,
        invite_link: inviteLink,
        temporary_password: temporaryPassword,
      });
    } catch (e) {
      console.error("Error patching sale:", e);
      return createErrorResponse(500, "Internal Server Error");
    }
  } catch (error) {
    return errorResponseFromUnknown(error);
  }
}

async function patchUser(req: Request, currentUserSale: any) {
  try {
    const body = await parseRequiredJsonBody(req);
    const sales_id = getPositiveIntegerField(body, "sales_id", {
      required: true,
    });
    const email = getOptionalStringField(body, "email");
    const first_name = getOptionalStringField(body, "first_name");
    const last_name = getOptionalStringField(body, "last_name");
    // Avatar is stored as a jsonb object ({ src, path, title, type }) to match
    // the `sales.avatar` column and how it is rendered across the app.
    const avatarValue = body.avatar;
    let avatar: Record<string, unknown> | undefined;
    if (avatarValue !== undefined && avatarValue !== null) {
      if (
        typeof avatarValue !== "object" ||
        Array.isArray(avatarValue) ||
        typeof (avatarValue as { src?: unknown }).src !== "string"
      ) {
        return createErrorResponse(
          400,
          "avatar must be an object with a string src",
        );
      }
      avatar = avatarValue as Record<string, unknown>;
    }
    const administrator = getOptionalBooleanField(body, "administrator");
    const disabled = getOptionalBooleanField(body, "disabled");

    if (email !== undefined && !isValidEmail(email)) {
      return createErrorResponse(400, "Invalid email address");
    }
    if (first_name !== undefined && !isValidName(first_name)) {
      return createErrorResponse(400, "Invalid first_name (max 100 chars)");
    }
    if (last_name !== undefined && !isValidName(last_name)) {
      return createErrorResponse(400, "Invalid last_name (max 100 chars)");
    }

    const { data: sale } = await supabaseAdmin
      .from("sales")
      .select("*")
      .eq("id", sales_id)
      .single();

    if (!sale) {
      return createErrorResponse(404, "Not Found");
    }

    // Users can only update their own profile unless they are an administrator
    if (!currentUserSale.administrator && currentUserSale.id !== sale.id) {
      return createErrorResponse(401, "Not Authorized");
    }

    const { data, error: userError } =
      await supabaseAdmin.auth.admin.updateUserById(sale.user_id, {
        email,
        ban_duration:
          disabled === undefined ? undefined : disabled ? "87600h" : "none",
        user_metadata: { first_name, last_name },
      });

    if (!data?.user || userError) {
      console.error("Error patching user:", userError);
      return createErrorResponse(500, "Internal Server Error");
    }

    if (avatar) {
      await updateSaleAvatar(data.user.id, avatar);
    }

    // Only administrators can update the administrator and disabled status
    if (!currentUserSale.administrator) {
      const { data: new_sale } = await supabaseAdmin
        .from("sales")
        .select("*")
        .eq("id", sales_id)
        .single();
      return createJsonResponse({
        data: new_sale,
      });
    }

    try {
      await updateSaleDisabled(
        data.user.id,
        disabled ?? sale.disabled ?? false,
      );
      const updatedSale = await updateSaleAdministrator(
        data.user.id,
        administrator ?? sale.administrator ?? false,
      );
      return createJsonResponse({
        data: updatedSale,
      });
    } catch (e) {
      console.error("Error patching sale:", e);
      return createErrorResponse(500, "Internal Server Error");
    }
  } catch (error) {
    return errorResponseFromUnknown(error);
  }
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user) => {
        const currentUserSale = await getUserSale(user);
        if (!currentUserSale) {
          return createErrorResponse(401, "Unauthorized");
        }

        if (req.method === "POST") {
          return inviteUser(req, currentUserSale);
        }

        if (req.method === "PATCH") {
          return patchUser(req, currentUserSale);
        }

        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  ),
);
