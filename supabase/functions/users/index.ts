import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import {
  findInvalidEmail,
  normalizeSecondaryEmails,
} from "./secondaryEmails.ts";

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

async function findEmailUsedByAnotherSale(
  emails: string[],
  excludeSalesId?: number,
) {
  for (const email of emails) {
    let query = supabaseAdmin
      .from("sales")
      .select("id")
      .or(`email.eq.${email},secondary_emails.cs.${JSON.stringify([email])}`);

    if (excludeSalesId !== undefined) {
      query = query.neq("id", excludeSalesId);
    }

    const { data: matches, error: salesError } = await query.limit(1);

    if (salesError) {
      console.error("Error fetching sales:", salesError);
      throw salesError;
    }

    if (matches?.length) {
      return email;
    }
  }

  return undefined;
}

async function updateSaleSecondaryEmails(
  user_id: string,
  secondary_emails: string[],
) {
  const { error: salesError } = await supabaseAdmin
    .from("sales")
    .update({ secondary_emails })
    .eq("user_id", user_id);

  if (salesError) {
    console.error("Error updating user:", salesError);
    throw salesError;
  }
}

async function updateSaleAvatar(user_id: string, avatar: string) {
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

async function inviteUser(req: Request, currentUserSale: any) {
  const { email, password, first_name, last_name, disabled, administrator } =
    await req.json();

  if (!currentUserSale.administrator) {
    return createErrorResponse(401, "Not Authorized");
  }

  const takenEmail = await findEmailUsedByAnotherSale(
    email ? [email.trim().toLowerCase()] : [],
  );
  if (takenEmail) {
    return createErrorResponse(
      409,
      `Email already used by another user: ${takenEmail}`,
      { code: "email_taken", email: takenEmail },
    );
  }

  const { data, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    user_metadata: { first_name, last_name },
  });

  let user = data?.user;

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
        return createErrorResponse(
          400,
          "A sales for this email already exists",
        );
      }

      const sale = await createSale(user.id, {
        email,
        password,
        first_name,
        last_name,
        disabled,
        administrator,
      });

      return new Response(
        JSON.stringify({
          data: sale,
        }),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
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
    const { error: emailError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (emailError) {
      console.error(`Error inviting user, email_error=${emailError}`);
      return createErrorResponse(500, "Failed to send invitation mail");
    }
  }

  try {
    await updateSaleDisabled(user.id, disabled);
    const sale = await updateSaleAdministrator(user.id, administrator);

    return new Response(
      JSON.stringify({
        data: sale,
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (e) {
    console.error("Error patching sale:", e);
    return createErrorResponse(500, "Internal Server Error");
  }
}

async function patchUser(req: Request, currentUserSale: any) {
  const {
    sales_id,
    email,
    secondary_emails,
    first_name,
    last_name,
    avatar,
    administrator,
    disabled,
  } = await req.json();
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

  if (email && email.trim().toLowerCase() !== sale.email.toLowerCase()) {
    const takenEmail = await findEmailUsedByAnotherSale(
      [email.trim().toLowerCase()],
      sales_id,
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
      sales_id,
    );
    if (takenEmail) {
      return createErrorResponse(
        409,
        `Secondary email already used by another user: ${takenEmail}`,
        { code: "secondary_email_taken", email: takenEmail },
      );
    }
  }

  const { data, error: userError } =
    await supabaseAdmin.auth.admin.updateUserById(sale.user_id, {
      email,
      ban_duration: disabled ? "87600h" : "none",
      user_metadata: { first_name, last_name },
    });

  if (!data?.user || userError) {
    console.error("Error patching user:", userError);
    return createErrorResponse(500, "Internal Server Error");
  }

  try {
    if (avatar) {
      await updateSaleAvatar(data.user.id, avatar);
    }

    if (normalizedSecondaryEmails) {
      await updateSaleSecondaryEmails(data.user.id, normalizedSecondaryEmails);
    }
  } catch (e) {
    console.error("Error patching sale:", e);
    return createErrorResponse(500, "Internal Server Error");
  }

  // Only administrators can update the administrator and disabled status
  if (!currentUserSale.administrator) {
    const { data: new_sale } = await supabaseAdmin
      .from("sales")
      .select("*")
      .eq("id", sales_id)
      .single();
    return new Response(
      JSON.stringify({
        data: new_sale,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  }

  try {
    await updateSaleDisabled(data.user.id, disabled);
    const sale = await updateSaleAdministrator(data.user.id, administrator);
    return new Response(
      JSON.stringify({
        data: sale,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  } catch (e) {
    console.error("Error patching sale:", e);
    return createErrorResponse(500, "Internal Server Error");
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

        try {
          if (req.method === "POST") {
            return await inviteUser(req, currentUserSale);
          }

          if (req.method === "PATCH") {
            return await patchUser(req, currentUserSale);
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
