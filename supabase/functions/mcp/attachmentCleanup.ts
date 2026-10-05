import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  ATTACHMENTS_BUCKET,
  getPathsToDelete,
  type WebhookPayload,
} from "../_shared/noteAttachments.ts";

export const NOTE_ATTACHMENT_CHANGES_SETTING =
  "atomic_crm.note_attachment_changes";

export const getRemovedAttachmentPaths = (
  setting: string | null | undefined,
): string[] => {
  if (!setting) {
    return [];
  }

  let changes: unknown;
  try {
    changes = JSON.parse(setting);
  } catch (error) {
    console.error("Ignoring malformed note attachment changes", { error });
    return [];
  }

  if (!Array.isArray(changes)) {
    return [];
  }

  const paths = changes.flatMap((change) => {
    try {
      return getPathsToDelete(change as WebhookPayload);
    } catch (error) {
      console.error("Ignoring malformed note attachment change", {
        change,
        error,
      });
      return [];
    }
  });

  return Array.from(new Set(paths));
};

export const deleteAttachmentsAsUser = async (
  paths: string[],
  userToken: string,
): Promise<void> => {
  if (paths.length === 0) {
    return;
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SB_PUBLISHABLE_KEY") ?? "",
      {
        global: { headers: { Authorization: `Bearer ${userToken}` } },
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );
    const { error } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .remove(paths);
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error("Failed to delete note attachments", { paths, error });
  }
};
