import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function errorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ status, message }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
    status,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse(405, "Method Not Allowed");
  }

  // Verify caller is authenticated
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse(401, "Missing authorization");
  }
  const token = authHeader.split(" ")[1];
  const {
    data: { user: callerUser },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);
  if (authError || !callerUser) {
    return errorResponse(401, "Unauthorized");
  }

  let task_id: number | string;
  try {
    ({ task_id } = await req.json());
  } catch {
    return errorResponse(400, "Invalid JSON body");
  }
  if (!task_id) {
    return errorResponse(400, "Missing task_id");
  }

  // Fetch task details
  const { data: task, error: taskError } = await supabaseAdmin
    .from("tasks")
    .select("id, text, due_date, type, priority, sales_id")
    .eq("id", task_id)
    .single();

  if (taskError || !task) {
    console.error("notify_task_assigned: task not found", taskError);
    return errorResponse(404, "Task not found");
  }

  if (!task.sales_id) {
    return new Response(JSON.stringify({ skipped: "no assignee" }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // Fetch assignee email + name
  const { data: assignee, error: assigneeError } = await supabaseAdmin
    .from("sales")
    .select("first_name, last_name, email")
    .eq("id", task.sales_id)
    .single();

  if (assigneeError || !assignee) {
    console.error("notify_task_assigned: assignee not found", assigneeError);
    return errorResponse(500, "Assignee not found");
  }

  // Fetch assigner name (caller)
  const { data: assigner } = await supabaseAdmin
    .from("sales")
    .select("first_name, last_name")
    .eq("user_id", callerUser.id)
    .single();

  const assignerName = assigner
    ? `${assigner.first_name} ${assigner.last_name}`
    : "Your manager";

  const POSTMARK_SERVER_TOKEN = Deno.env.get("POSTMARK_SERVER_TOKEN");
  const POSTMARK_FROM_EMAIL = Deno.env.get("POSTMARK_FROM_EMAIL");

  if (!POSTMARK_SERVER_TOKEN || !POSTMARK_FROM_EMAIL) {
    console.error(
      "notify_task_assigned: POSTMARK_SERVER_TOKEN or POSTMARK_FROM_EMAIL not configured",
    );
    return errorResponse(500, "Email not configured");
  }

  const dueDateFormatted = new Date(task.due_date).toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Mbabane",
  });

  const priorityLabel =
    task.priority === "high"
      ? "High"
      : task.priority === "low"
        ? "Low"
        : "Medium";

  const textBody = [
    `Hi ${assignee.first_name},`,
    ``,
    `${assignerName} has assigned you a new task:`,
    ``,
    `  Task:     ${task.text}`,
    `  Due:      ${dueDateFormatted}`,
    `  Priority: ${priorityLabel}`,
    ``,
    `Log in to the CRM to view and manage your tasks.`,
    ``,
    `— Eswatini CRM`,
  ].join("\n");

  const htmlBody = `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
  <h2 style="margin-bottom:4px">New Task Assigned</h2>
  <p style="color:#555;margin-top:0">Hi ${assignee.first_name},</p>
  <p>${assignerName} has assigned you a new task:</p>
  <table style="border-collapse:collapse;width:100%;margin:16px 0">
    <tr>
      <td style="padding:8px 12px;background:#f5f5f5;font-weight:600;width:90px;border-radius:4px 0 0 4px">Task</td>
      <td style="padding:8px 12px;background:#fafafa;border-radius:0 4px 4px 0">${task.text}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;background:#f5f5f5;font-weight:600;border-radius:4px 0 0 4px">Due</td>
      <td style="padding:8px 12px;background:#fafafa;border-radius:0 4px 4px 0">${dueDateFormatted}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;background:#f5f5f5;font-weight:600;border-radius:4px 0 0 4px">Priority</td>
      <td style="padding:8px 12px;background:#fafafa;border-radius:0 4px 4px 0">${priorityLabel}</td>
    </tr>
  </table>
  <p style="color:#777;font-size:13px">Log in to the CRM to view and manage your tasks.</p>
</div>`;

  const emailRes = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": POSTMARK_SERVER_TOKEN,
    },
    body: JSON.stringify({
      From: POSTMARK_FROM_EMAIL,
      To: assignee.email,
      Subject: `Task assigned to you: ${task.text.substring(0, 60)}`,
      TextBody: textBody,
      HtmlBody: htmlBody,
      MessageStream: "outbound",
    }),
  });

  if (!emailRes.ok) {
    const body = await emailRes.text();
    console.error(
      "notify_task_assigned: Postmark error",
      emailRes.status,
      body,
    );
    return errorResponse(502, "Failed to send email");
  }

  return new Response(JSON.stringify({ sent: true }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});
