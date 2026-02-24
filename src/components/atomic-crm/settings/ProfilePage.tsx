import { useMutation } from "@tanstack/react-query";
import { CircleX, Copy, Pencil, Save } from "lucide-react";
import {
  Form,
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useNotify,
  useRecordContext,
  useTranslate,
} from "ra-core";
import { useState } from "react";
import { useFormState } from "react-hook-form";
import { RecordField } from "@/components/admin/record-field";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import ImageEditorField from "../misc/ImageEditorField";
import type { CrmDataProvider } from "../providers/types";
import type { Sale, SalesFormData } from "../types";

export const ProfilePage = () => {
  const [isEditMode, setEditMode] = useState(false);
  const { identity, refetch: refetchIdentity } = useGetIdentity();
  const { data, refetch: refetchUser } = useGetOne("sales", {
    id: identity?.id,
  });
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();

  const { mutate } = useMutation({
    mutationKey: ["signup"],
    mutationFn: async (data: SalesFormData) => {
      if (!identity) {
        throw new Error("Record not found");
      }
      return dataProvider.salesUpdate(identity.id, data);
    },
    onSuccess: () => {
      refetchIdentity();
      refetchUser();
      setEditMode(false);
      notify("crm.profile.notifications.updated", {
        messageArgs: { _: "Your profile has been updated" },
      });
    },
    onError: (_) => {
      notify("crm.notifications.generic_error", {
        type: "error",
        messageArgs: { _: "An error occurred. Please try again" },
      });
    },
  });

  if (!identity) return null;

  const handleOnSubmit = async (values: any) => {
    mutate(values);
  };

  return (
    <div className="max-w-lg mx-auto mt-8">
      <Form onSubmit={handleOnSubmit} record={data}>
        <ProfileForm isEditMode={isEditMode} setEditMode={setEditMode} />
      </Form>
    </div>
  );
};

const ProfileForm = ({
  isEditMode,
  setEditMode,
}: {
  isEditMode: boolean;
  setEditMode: (value: boolean) => void;
}) => {
  const notify = useNotify();
  const translate = useTranslate();
  const record = useRecordContext<Sale>();
  const { identity, refetch } = useGetIdentity();
  const { isDirty } = useFormState();
  const dataProvider = useDataProvider<CrmDataProvider>();

  const { mutate: updatePassword } = useMutation({
    mutationKey: ["updatePassword"],
    mutationFn: async () => {
      if (!identity) {
        throw new Error("Record not found");
      }
      return dataProvider.updatePassword(identity.id);
    },
    onSuccess: () => {
      notify("crm.profile.notifications.password_reset_sent", {
        messageArgs: {
          _: "A reset password email has been sent to your email address",
        },
      });
    },
    onError: (e) => {
      notify(`${e}`, {
        type: "error",
      });
    },
  });

  const { mutate: mutateSale } = useMutation({
    mutationKey: ["signup"],
    mutationFn: async (data: SalesFormData) => {
      if (!record) {
        throw new Error("Record not found");
      }
      return dataProvider.salesUpdate(record.id, data);
    },
    onSuccess: () => {
      refetch();
      notify("crm.profile.notifications.updated", {
        messageArgs: { _: "Your profile has been updated" },
      });
    },
    onError: () => {
      notify("crm.notifications.generic_error", {
        messageArgs: { _: "An error occurred. Please try again." },
      });
    },
  });
  if (!identity) return null;

  const handleClickOpenPasswordChange = () => {
    updatePassword();
  };

  const handleAvatarUpdate = async (values: any) => {
    mutateSale(values);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <div className="mb-4 flex flex-row justify-between">
            <h2 className="text-xl font-semibold text-muted-foreground">
              {translate("crm.profile.title", { _: "Profile" })}
            </h2>
          </div>

          <div className="space-y-4 mb-4">
            <ImageEditorField
              source="avatar"
              type="avatar"
              onSave={handleAvatarUpdate}
              linkPosition="right"
            />
            <TextRender
              source="first_name"
              isEditMode={isEditMode}
              resource="sales"
            />
            <TextRender
              source="last_name"
              isEditMode={isEditMode}
              resource="sales"
            />
            <TextRender source="email" isEditMode={isEditMode} resource="sales" />
          </div>

          <div className="flex flex-row justify-end gap-2">
            {!isEditMode && (
              <>
                <Button
                  variant="outline"
                  type="button"
                  onClick={handleClickOpenPasswordChange}
                >
                  {translate("crm.profile.change_password", {
                    _: "Change password",
                  })}
                </Button>
              </>
            )}

            <Button
              type="button"
              variant={isEditMode ? "ghost" : "outline"}
              onClick={() => setEditMode(!isEditMode)}
              className="flex items-center"
            >
              {isEditMode ? <CircleX /> : <Pencil />}
              {isEditMode
                ? translate("ra.action.cancel", { _: "Cancel" })
                : translate("ra.action.edit", { _: "Edit" })}
            </Button>

            {isEditMode && (
              <Button type="submit" disabled={!isDirty} variant="outline">
                <Save />
                {translate("ra.action.save", { _: "Save" })}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      {import.meta.env.VITE_INBOUND_EMAIL && (
        <Card>
          <CardContent>
            <div className="space-y-4 justify-between">
              <h2 className="text-xl font-semibold text-muted-foreground">
                {translate("crm.profile.inbound_email.title", {
                  _: "Inbound email",
                })}
              </h2>
              <p className="text-sm text-muted-foreground">
                {translate("crm.profile.inbound_email.description_prefix", {
                  _:
                    "You can start sending emails to your server's inbound email address, e.g. by adding it to the",
                })}
                <b> Cc: </b>
                {translate("crm.profile.inbound_email.description_suffix", {
                  _:
                    "field. Atomic CRM will process the emails and add notes to the corresponding contacts.",
                })}
              </p>
              <CopyPaste />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const TextRender = ({
  source,
  isEditMode,
  resource,
}: {
  source: string;
  isEditMode: boolean;
  resource?: string;
}) => {
  if (isEditMode) {
    return <TextInput source={source} helperText={false} />;
  }
  return (
    <div className="m-2">
      <RecordField source={source} resource={resource} />
    </div>
  );
};

const CopyPaste = () => {
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
          <Button
            type="button"
            onClick={handleCopy}
            variant="ghost"
            className="normal-case justify-between w-full"
          >
            <span className="overflow-hidden text-ellipsis">
              {import.meta.env.VITE_INBOUND_EMAIL}
            </span>
            <Copy className="h-4 w-4 ml-2" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {copied
              ? translate("crm.profile.copied", { _: "Copied!" })
              : translate("crm.profile.copy", { _: "Copy" })}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

ProfilePage.path = "/profile";
