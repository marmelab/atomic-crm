import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/components/admin/use-theme";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemActions,
  ItemGroup,
  ItemSeparator,
} from "@/components/ui/item";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Copy, LogOut, Moon, Smartphone, Sun } from "lucide-react";
import {
  Form,
  Translate,
  useAuthProvider,
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useLocaleState,
  useLocales,
  useLogout,
  useNotify,
  useTranslate,
} from "ra-core";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { MobileContent } from "../layout/MobileContent";
import MobileHeader from "../layout/MobileHeader";
import ImageEditorField from "../misc/ImageEditorField";
import type { CrmDataProvider } from "../providers/types";
import type { SalesFormData } from "../types";

const ChangePasswordButton = () => {
  const translate = useTranslate();
  const notify = useNotify();
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider<CrmDataProvider>();

  const { mutate: updatePassword } = useMutation({
    mutationKey: ["updatePassword"],
    mutationFn: async () => {
      if (!identity) {
        throw new Error(
          translate("crm.profile.record_not_found", {
            _: "Record not found",
          }),
        );
      }
      return dataProvider.updatePassword(identity.id);
    },
    onSuccess: () => {
      notify("crm.profile.password_reset_sent", {
        messageArgs: {
          _: "A reset password email has been sent to your email address",
        },
      });
    },
    onError: (e) => {
      notify(`${e}`, { type: "error" });
    },
  });

  return (
    <Button
      variant="outline"
      className="w-full text-base h-auto"
      onClick={() => updatePassword()}
    >
      <KeyRound className="size-5 mr-3" />
      {translate("crm.profile.password.change")}
    </Button>
  );
};

export const SettingsPageMobile = () => {
  const translate = useTranslate();
  const authProvider = useAuthProvider();
  const logout = useLogout();

  if (!authProvider) return null;

  return (
    <>
      <MobileHeader>
        <h1 className="text-xl font-semibold">
          {translate("crm.settings.title")}
        </h1>
      </MobileHeader>
      <MobileContent>
        <div className="flex flex-col min-h-[calc(100dvh-3.5rem-4.5rem)]">
          <div className="space-y-6">
            <ProfileSection />
            <PreferencesSection />
            <InboundEmailSection />
          </div>

          <div className="mt-auto pt-6 space-y-3">
            <ChangePasswordButton />
            <Button
              variant="destructive"
              className="w-full text-base h-auto"
              onClick={() => logout()}
            >
              <LogOut className="size-5 mr-3" />
              <Translate i18nKey="ra.auth.logout">Log out</Translate>
            </Button>
          </div>
        </div>
      </MobileContent>
    </>
  );
};

SettingsPageMobile.path = "/settings";

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 mb-1.5">
    {children}
  </p>
);

const ProfileSection = () => {
  const { identity, refetch: refetchIdentity } = useGetIdentity();
  const { data, refetch: refetchUser } = useGetOne("sales", {
    id: identity?.id,
  });
  const translate = useTranslate();
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();

  const saveField = useCallback(
    async (field: string, value: string) => {
      if (!identity || !data) return;
      const current = data[field as keyof typeof data];
      if (value === current) return;

      const queryKey = [
        "sales",
        "getOne",
        { id: String(identity.id), meta: undefined },
      ];
      const previousData = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any) =>
        old ? { ...old, [field]: value } : old,
      );

      try {
        await dataProvider.salesUpdate(identity.id, {
          ...data,
          [field]: value,
        } as SalesFormData);
        refetchIdentity();
        refetchUser();
        notify("crm.profile.updated", {
          messageArgs: { _: "Your profile has been updated" },
        });
      } catch {
        queryClient.setQueryData(queryKey, previousData);
        notify("crm.profile.update_error", {
          type: "error",
          messageArgs: { _: "An error occurred. Please try again" },
        });
      }
    },
    [
      identity,
      data,
      dataProvider,
      refetchIdentity,
      refetchUser,
      notify,
      queryClient,
    ],
  );

  const handleAvatarUpdate = useCallback(
    async (values: SalesFormData) => {
      if (!data) return;
      try {
        await dataProvider.salesUpdate(data.id, values);
        refetchIdentity();
        refetchUser();
        notify("crm.profile.updated", {
          messageArgs: { _: "Your profile has been updated" },
        });
      } catch {
        notify("crm.profile.update_error", {
          type: "error",
          messageArgs: { _: "An error occurred. Please try again." },
        });
      }
    },
    [data, dataProvider, refetchIdentity, refetchUser, notify],
  );

  if (!identity || !data) return null;

  return (
    <div>
      <SectionLabel>
        {translate("crm.profile.title", { _: "Profile" })}
      </SectionLabel>
      <ItemGroup className="rounded-lg border overflow-hidden">
        <Form record={data}>
          <Item size="sm">
            <ItemContent>
              <ImageEditorField
                source="avatar"
                type="avatar"
                onSave={handleAvatarUpdate}
                linkPosition="right"
              />
            </ItemContent>
          </Item>
        </Form>

        <ItemSeparator />

        <InlineEditRow
          label={translate("resources.sales.fields.first_name")}
          value={data.first_name ?? ""}
          onSave={(v) => saveField("first_name", v)}
        />

        <ItemSeparator />

        <InlineEditRow
          label={translate("resources.sales.fields.last_name")}
          value={data.last_name ?? ""}
          onSave={(v) => saveField("last_name", v)}
        />

        <ItemSeparator />

        <InlineEditRow
          label={translate("resources.sales.fields.email")}
          value={data.email ?? ""}
          onSave={(v) => saveField("email", v)}
        />
      </ItemGroup>
    </div>
  );
};

const InlineEditRow = ({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (value: string) => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    if (trimmed !== value) {
      onSave(trimmed);
    }
  }, [editValue, value, onSave]);

  const handleCancel = useCallback(() => {
    setEditValue(value);
    setIsEditing(false);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        inputRef.current?.blur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleCancel],
  );

  if (isEditing) {
    return (
      <Item size="sm">
        <ItemContent>
          <ItemTitle className="font-normal text-muted-foreground">
            {label}
          </ItemTitle>
        </ItemContent>
        <ItemActions>
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="bg-transparent text-right !text-base outline-none w-48"
          />
        </ItemActions>
      </Item>
    );
  }

  return (
    <Item
      size="sm"
      className="cursor-pointer"
      onClick={() => setIsEditing(true)}
    >
      <ItemContent>
        <ItemTitle className="font-normal text-muted-foreground">
          {label}
        </ItemTitle>
      </ItemContent>
      <ItemActions>
        <span className="text-base">{value}</span>
      </ItemActions>
    </Item>
  );
};

const PreferencesSection = () => {
  const translate = useTranslate();

  return (
    <div>
      <SectionLabel>
        {translate("crm.settings.preferences", { _: "Preferences" })}
      </SectionLabel>
      <ItemGroup className="rounded-lg border overflow-hidden">
        <LanguageRow />
        <ItemSeparator />
        <ThemeRow />
      </ItemGroup>
    </div>
  );
};

const LanguageRow = () => {
  const translate = useTranslate();
  const locales = useLocales();
  const [locale, setLocale] = useLocaleState();

  if (locales.length <= 1) return null;

  return (
    <Item size="sm">
      <ItemContent>
        <ItemTitle className="font-normal text-muted-foreground">
          {translate("crm.language")}
        </ItemTitle>
      </ItemContent>
      <ItemActions>
        <Select value={locale} onValueChange={setLocale}>
          <SelectTrigger
            size="sm"
            className="w-auto !h-auto py-0 border-none shadow-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {locales.map((language) => (
              <SelectItem key={language.locale} value={language.locale}>
                {language.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ItemActions>
    </Item>
  );
};

const ThemeRow = () => {
  const translate = useTranslate();
  const { theme, setTheme } = useTheme();

  return (
    <Item size="sm" className="flex-col items-stretch gap-2">
      <ItemTitle className="font-normal text-muted-foreground">
        {translate("crm.theme.label", { _: "Theme" })}
      </ItemTitle>
      <ToggleGroup
        type="single"
        value={theme}
        onValueChange={(value) =>
          value && setTheme(value as "light" | "dark" | "system")
        }
        size="lg"
        variant="outline"
        className="w-full"
      >
        <ToggleGroupItem
          value="system"
          aria-label={translate("crm.theme.system")}
          className="flex-1 gap-2"
        >
          <Smartphone className="size-4" />
          {translate("crm.theme.system")}
        </ToggleGroupItem>
        <ToggleGroupItem
          value="light"
          aria-label={translate("crm.theme.light")}
          className="flex-1 gap-2"
        >
          <Sun className="size-4" />
          {translate("crm.theme.light")}
        </ToggleGroupItem>
        <ToggleGroupItem
          value="dark"
          aria-label={translate("crm.theme.dark")}
          className="flex-1 gap-2"
        >
          <Moon className="size-4" />
          {translate("crm.theme.dark")}
        </ToggleGroupItem>
      </ToggleGroup>
    </Item>
  );
};

const InboundEmailSection = () => {
  const translate = useTranslate();

  if (!import.meta.env.VITE_INBOUND_EMAIL) return null;

  return (
    <div>
      <SectionLabel>{translate("crm.profile.inbound.title")}</SectionLabel>
      <p className="text-sm text-muted-foreground mb-2 px-1">
        {translate("crm.profile.inbound.description", {
          _: "You can start sending emails to your server's inbound email address, e.g. by adding it to the Cc: field. Atomic CRM will process the emails and add notes to the corresponding contacts.",
          field: "Cc:",
        })}
      </p>
      <ItemGroup className="rounded-lg border overflow-hidden">
        <CopyPasteRow />
      </ItemGroup>
    </div>
  );
};

const CopyPasteRow = () => {
  const translate = useTranslate();
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    setCopied(true);
    navigator.clipboard.writeText(import.meta.env.VITE_INBOUND_EMAIL);
    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Item
            size="sm"
            className="cursor-pointer flex-nowrap"
            onClick={handleCopy}
          >
            <ItemContent className="overflow-hidden">
              <ItemTitle className="font-normal truncate">
                {import.meta.env.VITE_INBOUND_EMAIL}
              </ItemTitle>
            </ItemContent>
            <ItemActions className="shrink-0">
              <Copy className="size-4 text-muted-foreground" />
            </ItemActions>
          </Item>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {copied
              ? translate("crm.common.copied")
              : translate("crm.common.copy")}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
