import { decode } from "npm:base64-arraybuffer";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

export type Attachment = {
  title: string;
  type: string;
  path: string;
  // `src` is intentionally left empty when persisting: the attachments
  // bucket is private (see migrations/20260408140000_attachments_bucket_private.sql)
  // and the frontend re-mints a short-lived signed URL on every read via
  // the `afterRead` lifecycle hook in `dataProvider.ts`. We keep the field
  // for shape compatibility with the existing JSONB column.
  src: string;
};

/**
 * Extracts the attachments from a Postmark inbound email payload and uploads
 * them to the private `attachments` bucket on Supabase Storage.
 *
 * Each returned attachment carries only the storage `path`; the matching
 * frontend code resolves it to a fresh signed URL at read time.
 *
 * Example input:
 *   "Attachments": [
 *      {
 *          "Name": "test.txt",
 *          "Content": "VGhpcyBpcyBhdHRhY2htZW50IGNvbnRlbnRzLCBiYXNlLTY0IGVuY29kZWQu",
 *          "ContentType": "text/plain",
 *          "ContentLength": 45
 *      }
 *   ]
 *
 * Returned shape:
 *   [{
 *      title: "test.txt",
 *      type: "text/plain",
 *      path: "9b2c…uuid….txt",
 *      src: "",
 *   }]
 */
export const extractAndUploadAttachments = async (
  Attachments: {
    Name: string;
    Content: string;
    ContentType: string;
    ContentLength: number;
  }[],
): Promise<Attachment[]> => {
  return (
    await Promise.all(
      (Attachments || []).map(async (attachment) => {
        const { Name, Content, ContentType } = attachment;
        if (!Name || !Content || !ContentType) {
          console.warn("Attachment is missing required fields, skipping", {
            attachment,
          });
          return null;
        }

        const decodedContent = decode(Content);
        if (!decodedContent) {
          console.error("Failed to decode attachment content, skipping", {
            attachment,
          });
          return null;
        }

        const fileParts = Name.split(".");
        const fileExt = fileParts.length > 1 ? `.${Name.split(".").pop()}` : "";
        // crypto.randomUUID() gives 122 bits of entropy, replacing the old
        // Math.random()-based filenames that were enumerable when the bucket
        // was still public.
        const fileName = `${crypto.randomUUID()}${fileExt}`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from("attachments")
          .upload(fileName, decodedContent);

        if (uploadError) {
          console.error("uploadError", uploadError);
          throw new Error("Failed to upload attachment");
        }

        return {
          title: Name,
          type: ContentType,
          path: fileName,
          src: "",
        };
      }),
    )
  ).filter(Boolean) as Attachment[];
};
