import { useState } from "react";
import { useResetPassword } from "ra-supabase-core";
import { Form, required, useNotify, useTranslate } from "ra-core";
import { Layout } from "@/components/supabase/layout";
import type { FieldValues, SubmitHandler } from "react-hook-form";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";

interface FormData {
  email: string;
}

export const ForgotPasswordPage = () => {
  const [loading, setLoading] = useState(false);

  const notify = useNotify();
  const translate = useTranslate();
  const [, { mutateAsync: resetPassword }] = useResetPassword();

  const submit = async (values: FormData) => {
    try {
      setLoading(true);
      await resetPassword({
        email: values.email,
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
          {translate("ra-supabase.reset_password.forgot_password", {
            _: "Forgot password?",
          })}
        </h1>
        <p>
          {translate("ra-supabase.reset_password.forgot_password_details", {
            _: "Enter your email to receive a reset password link.",
          })}
        </p>
      </div>
      <Form<FormData>
        className="space-y-8"
        onSubmit={submit as SubmitHandler<FieldValues>}
      >
        <TextInput
          source="email"
          label={translate("ra.auth.email", {
            _: "Email",
          })}
          autoComplete="email"
          validate={required()}
        />
        <Button type="submit" className="cursor-pointer" disabled={loading}>
          {translate("ra.action.reset_password", {
            _: "Reset password",
          })}
        </Button>
      </Form>
    </Layout>
  );
};

ForgotPasswordPage.path = "forgot-password";
