import { Plus } from "lucide-react";
import { useTranslate } from "ra-core";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

/** Desktop app bar shortcut — company create only (leads start from the company). */
export const NewRecordButton = () => {
  const translate = useTranslate();
  return (
    <Button
      size="sm"
      className="gap-1.5"
      render={<Link to="/companies/create" />}
    >
      <Plus />
      {translate("resources.companies.action.new", { _: "New Company" })}
    </Button>
  );
};
