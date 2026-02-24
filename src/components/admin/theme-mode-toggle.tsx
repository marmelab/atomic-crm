import { Check, Moon, Sun } from "lucide-react";
import { useTranslate } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/admin/use-theme";

/**
 * Toggle button that lets users switch between light, dark, and system UI themes.
 *
 * User's selection is persisted using the store.
 * Automatically included in the default Layout component header.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/thememodetoggle ThemeModeToggle documentation}
 */
export function ThemeModeToggle() {
  const { theme, setTheme } = useTheme();
  const translate = useTranslate();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="hidden sm:inline-flex">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">
            {translate("crm.theme.toggle", { _: "Toggle theme" })}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          {translate("crm.theme.light_short", { _: "Light" })}
          <Check className={cn("ml-auto", theme !== "light" && "hidden")} />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          {translate("crm.theme.dark_short", { _: "Dark" })}
          <Check className={cn("ml-auto", theme !== "dark" && "hidden")} />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          {translate("crm.theme.system_short", { _: "System" })}
          <Check className={cn("ml-auto", theme !== "system" && "hidden")} />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
