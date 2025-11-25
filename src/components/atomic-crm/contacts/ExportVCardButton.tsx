import { Download } from "lucide-react";
import { useGetOne, useRecordContext } from "ra-core";
import { Button } from "@/components/ui/button";
import type { Contact, Company } from "../types";
import { exportToVCard } from "./exportToVCard";

export const ExportVCardButton = () => {
  const contact = useRecordContext<Contact>();

  // Fetch the company data on mount
  const { data: company } = useGetOne<Company>(
    "companies",
    { id: contact?.company_id },
    { enabled: !!contact?.company_id },
  );

  const handleExport = async () => {
    if (!contact) return;

    // Fetch and convert avatar to base64 if it exists
    let photoData: { base64: string; mimeType: string } | undefined = undefined;

    if (contact.avatar?.src) {
      try {
        const response = await fetch(contact.avatar.src);
        const blob = await response.blob();
        const mimeType = blob.type || "image/png";

        // Convert blob to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            // Remove the data URL prefix (data:image/png;base64,)
            const base64Data = result.split(",")[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        photoData = { base64, mimeType };
      } catch (error) {
        console.error("Failed to fetch avatar image:", error);
        // Continue without the photo
      }
    }

    // Generate vCard content
    const vCardContent = exportToVCard(contact, company, photoData);

    // Create blob and download
    const blob = new Blob([vCardContent], {
      type: "text/vcard;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${contact.first_name}_${contact.last_name}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!contact) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      className="h-6 cursor-pointer"
    >
      <Download className="w-4 h-4" />
      Export to vCard
    </Button>
  );
};
