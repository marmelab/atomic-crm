import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getUserSale } from "../_shared/getUserSale.ts";

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
    first_name: string;
    last_name: string;
    disabled: boolean;
    administrator: boolean;
  },
) {
  // Only insert columns that actually exist on the sales table (no password).
  const { data: sales, error: salesError } = await supabaseAdmin
    .from("sales")
    .insert({
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      disabled: data.disabled ?? false,
      administrator: data.administrator ?? false,
      user_id,
    })
    .select("*");

  if (!sales?.length || salesError) {
    console.error("Error creating user:", salesError);
    throw salesError ?? new Error("Failed to create sale");
  }
  return sales.at(0);
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
  const { email, first_name, last_name, disabled, administrator } =
    await req.json();

  if (!currentUserSale.administrator) {
    return createErrorResponse(401, "Not Authorized");
  }

  // Invite the user by email. A single call both creates the auth user (in an
  // "invited" state, no password yet) AND sends the invitation email so the
  // person can follow the link and set their own password.
  // The optional SITE_URL env var lets the invite link point back to the app
  // (falls back to the project's configured Site URL when unset).
  const redirectTo = Deno.env.get("SITE_URL") || undefined;
  const { data, error: inviteError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { first_name, last_name },
      ...(redirectTo ? { redirectTo } : {}),
    });

  let user = data?.user;

  if (inviteError) {
    // The auth user may already exist if the database was reset but the auth
    // users were not, or if the sales row was deleted. Recover by locating the
    // existing user and ensuring a sales row exists for them. No invitation
    // email is (re)sent in this branch.
    if ((inviteError as any).code === "email_exists") {
      const { data: existing, error: rpcError } = await supabaseAdmin.rpc(
        "get_user_id_by_email",
        { email },
      );

      if (!existing?.length || rpcError) {
        console.error(
          `Error inviting user: ${rpcError ?? "could not fetch user for email"}`,
        );
        return createErrorResponse(500, "Internal Server Error");
      }

      user = existing[0];

      const { data: existingSale, error: salesError } = await supabaseAdmin
        .from("sales")
        .select("id")
        .eq("user_id", user.id);
      if (salesError) {
        return createErrorResponse(salesError.status ?? 500, salesError.message, {
          code: salesError.code,
        });
      }
      if (existingSale && existingSale.length > 0) {
        return createErrorResponse(400, "A user with this email already exists");
      }

      try {
        await createSale(user.id, {
          email,
          first_name,
          last_name,
          disabled,
          administrator,
        });
      } catch (error) {
        return createErrorResponse(
          (error as any).status ?? 500,
          (error as Error).message,
          { code: (error as any).code },
        );
      }
    } else {
      console.error(
        `Error inviting user, invite_error=${JSON.stringify(inviteError)}`,
      );
      return createErrorResponse(
        (inviteError as any).status ?? 500,
        inviteError.message || "Failed to send invitation email",
        { code: (inviteError as any).code },
      );
    }
  }

  if (!user) {
    console.error("Error inviting user: undefined user");
    return createErrorResponse(500, "Internal Server Error");
  }

  // The on_auth_user_created trigger creates the sales row from the invite
  // metadata; apply the admin-only flags (disabled / administrator) on top.
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

// Every table that references public.sales, keyed by the column holding the
// sales id. On delete we move these records to the admin performing the
// deletion so no data is lost and no foreign-key constraint is violated.
const SALES_OWNED_TABLES: { table: string; column: string }[] = [
  { table: "companies", column: "sales_id" },
  { table: "contacts", column: "sales_id" },
  { table: "contact_notes", column: "sales_id" },
  { table: "deals", column: "sales_id" },
  { table: "deal_notes", column: "sales_id" },
  { table: "tasks", column: "sales_id" },
  { table: "compliance_filings", column: "assigned_to" },
];

async function deleteUser(req: Request, currentUserSale: any) {
  if (!currentUserSale.administrator) {
    return createErrorResponse(401, "Not Authorized");
  }

  const { sales_id } = await req.json();
  if (sales_id == null) {
    return createErrorResponse(400, "Missing sales_id");
  }

  // An admin must not delete their own account (it would orphan ownership and
  // could lock the instance out of its last administrator).
  if (String(currentUserSale.id) === String(sales_id)) {
    return createErrorResponse(400, "You cannot delete your own account");
  }

  const { data: sale, error: saleError } = await supabaseAdmin
    .from("sales")
    .select("id, user_id")
    .eq("id", sales_id)
    .single();

  if (saleError || !sale) {
    return createErrorResponse(404, "User not found");
  }

  const newOwnerId = currentUserSale.id;

  // 1. Reassign all owned records to the deleting admin.
  for (const { table, column } of SALES_OWNED_TABLES) {
    const { error } = await supabaseAdmin
      .from(table)
      .update({ [column]: newOwnerId })
      .eq(column, sale.id);
    if (error) {
      console.error(`Error reassigning ${table}.${column}:`, error);
      return createErrorResponse(
        500,
        `Failed to reassign ${table} records before deletion`,
      );
    }
  }

  // 2. Delete the sales row (service role bypasses RLS). Safe now that nothing
  // references it.
  const { error: deleteSaleError } = await supabaseAdmin
    .from("sales")
    .delete()
    .eq("id", sale.id);
  if (deleteSaleError) {
    console.error("Error deleting sale:", deleteSaleError);
    return createErrorResponse(500, "Failed to delete the user record");
  }

  // 3. Delete the auth user so they can no longer sign in. Allowed now that the
  // sales row referencing this auth user is gone.
  const { error: deleteAuthError } =
    await supabaseAdmin.auth.admin.deleteUser(sale.user_id);
  if (deleteAuthError) {
    console.error("Error deleting auth user:", deleteAuthError);
    return createErrorResponse(500, "Failed to delete the user login");
  }

  return new Response(JSON.stringify({ data: { id: sale.id } }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
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

        if (req.method === "DELETE") {
          return deleteUser(req, currentUserSale);
        }

        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  ),
);
