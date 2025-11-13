import { useTranslate } from "ra-core";
import { Search } from "lucide-react";
import type { TextInputProps } from "@/components/admin/text-input";
import { TextInput } from "@/components/admin/text-input";
import { cn } from "@/lib/utils";

export const SearchInput = (inProps: SearchInputProps) => {
  const { label, className, ...rest } = inProps;

  const translate = useTranslate();

  if (label) {
    throw new Error(
      "<SearchInput> isn't designed to be used with a label prop. Use <TextInput> if you need a label.",
    );
  }

  return (
    <div className="flex flex-grow relative mt-auto">
      <TextInput
        label={false}
        helperText={false}
        placeholder={translate("ra.action.search")}
        className={cn("flex-grow", className)}
        inputClassName="pr-8"
        {...rest}
      />
      <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
    </div>
  );
};

export type SearchInputProps = TextInputProps;
