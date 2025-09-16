import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useLocales, useLocaleState } from "ra-core";

export function LocalesMenuButton() {
  const languages = useLocales();
  const [locale, setLocale] = useLocaleState();

  const getNameForLocale = (locale: string): string => {
    const language = languages.find((language) => language.locale === locale);
    return language ? language.name : "";
  };

  const changeLocale = (locale: string) => (): void => {
    setLocale(locale);
  };

  if (languages.length <= 1) {
    return null; // No need to render the dropdown if there's only one language
  }
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="hidden sm:inline-flex">
          {locale.toUpperCase()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.locale}
            onClick={changeLocale(language.locale)}
          >
            {getNameForLocale(language.locale)}
            <Check
              className={cn("ml-auto", locale !== language.locale && "hidden")}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
