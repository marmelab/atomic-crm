import { useTranslate } from "ra-core";
import { Search } from "lucide-react";
import { TextInput, type TextInputProps } from "@/components/admin/text-input";

export const SearchInput = (inProps: SearchInputProps) => {
  const { label, ...rest } = inProps;

  const translate = useTranslate();

  if (label) {
    throw new Error(
      "<SearchInput> isn't designed to be used with a label prop. Use <TextInput> if you need a label.",
    );
  }

  return (
    <div className="flex flex-grow relative mt-auto w-fit">
      <TextInput
        label={false}
        helperText={false}
        placeholder={translate("ra.action.search")}
        {...rest}
      />
      <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
    </div>
  );
};

export type SearchInputProps = TextInputProps;
