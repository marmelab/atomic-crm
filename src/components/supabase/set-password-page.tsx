import { useState } from "react";
import type { ValidateForm } from "ra-core";
import { Form, required, useNotify, useTranslate } from "ra-core";
import { useSetPassword, useSupabaseAccessToken } from "ra-supabase-core";
import type { FieldValues, SubmitHandler } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/admin/text-input";
import { Layout } from "@/components/supabase/layout";

interface FormData {
  password: string;
  confirmPassword: string;
}

export const SetPasswordPage = () => {
  const [loading, setLoading] = useState(false);

  const access_token = useSupabaseAccessToken();
  const refresh_token = useSupabaseAccessToken({
    parameterName: "refresh_token",
  });

  const notify = useNotify();
  const translate = useTranslate();
  const [, { mutateAsync: setPassword }] = useSetPassword();

  const validate = (values: FormData) => {
    if (values.password !== values.confirmPassword) {
      return {
        password: "ra-supabase.validation.password_mismatch",
        confirmPassword: "ra-supabase.validation.password_mismatch",
      };
    }
    return {};
  };

  if (!access_token || !refresh_token) {
    if (process.env.NODE_ENV === "development") {
      console.error("Missing access_token or refresh_token for set password");
    }
    return (
      <Layout>
        <p>{translate("ra-supabase.auth.missing_tokens")}</p>
      </Layout>
    );
  }

  const submit = async (values: FormData) => {
    try {
      setLoading(true);
      await setPassword({
        access_token,
        refresh_token,
        password: values.password,
      });
    } catch (error: any) {
      notify(
        typeof error === "string"
          ? error
          : typeof error === "undefined" || !error.message
            ? "ra.auth.sign_in_error"
            : error.message,
        {
          type: "warning",
          messageArgs: {
            _:
              typeof error === "string"
                ? error
                : error && error.message
                  ? error.message
                  : undefined,
          },
        },
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {translate("ra-supabase.set_password.new_password", {
            _: "Choose your password",
          })}
        </h1>
      </div>
      <Form<FormData>
        className="space-y-8"
        onSubmit={submit as SubmitHandler<FieldValues>}
        validate={validate as ValidateForm}
      >
        <TextInput
          label={translate("ra.auth.password", {
            _: "Password",
          })}
          autoComplete="new-password"
          source="password"
          type="password"
          validate={required()}
        />
        <TextInput
          label={translate("ra.auth.confirm_password", {
            _: "Confirm password",
          })}
          source="confirmPassword"
          type="password"
          validate={required()}
        />
        <Button type="submit" className="cursor-pointer" disabled={loading}>
          {translate("ra.action.save")}
        </Button>
      </Form>
    </Layout>
  );
};

SetPasswordPage.path = "set-password";
