import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import { email, required, useGetIdentity, useCreate, useNotify } from "ra-core";
import * as React from "react";
import { useFormContext } from "react-hook-form";

import {
  AutocompleteInput,
  BooleanInput,
  ReferenceInput,
  TextInput,
  RadioButtonGroupInput,
  SelectInput,
  ArrayInput,
} from "@/components/admin";
import { SimpleFormIterator } from "@/components/admin";
import { isLinkedinUrl } from "../misc/isLinkedInUrl";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { Sale } from "../types";
import { Avatar } from "./Avatar";

export const ContactInputs = () => {
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-col gap-2 p-1">
      <Avatar />
      <div className={`flex gap-4 ${isMobile ? "flex-col" : "flex-row"}`}>
        <div className="flex flex-col gap-6 flex-1">
          <ContactIdentityInputs />
          <ContactPositionInputs />
        </div>
        <Separator
          orientation={isMobile ? "horizontal" : "vertical"}
          className="flex-shrink-0"
        />
        <div className="flex flex-col gap-4 flex-1">
          <ContactPersonalInformationInputs />
          <ContactMiscInputs />
        </div>
      </div>
    </div>
  );
};

const ContactIdentityInputs = () => {
  const { contactGender } = useConfigurationContext();
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Identity</h6>
      <RadioButtonGroupInput
        label={false}
        row
        source="gender"
        choices={contactGender}
        helperText={false}
        optionText="label"
        optionValue="value"
        defaultValue={contactGender[0].value}
      />
      <TextInput source="first_name" validate={required()} helperText={false} />
      <TextInput source="last_name" validate={required()} helperText={false} />
    </div>
  );
};

const ContactPositionInputs = () => {
  const [create] = useCreate();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const handleCreateCompany = async (name?: string) => {
    if (!name) return;
    try {
      const newCompany = await create(
        "companies",
        {
          data: {
            name,
            sales_id: identity?.id,
            created_at: new Date().toISOString(),
          },
        },
        { returnPromise: true },
      );
      return newCompany;
    } catch {
      notify("An error occurred while creating the company", {
        type: "error",
      });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Position</h6>
      <TextInput source="title" helperText={false} />
      <ReferenceInput source="company_id" reference="companies">
        <AutocompleteInput
          optionText="name"
          helperText={false}
          onCreate={handleCreateCompany}
          createItemLabel="Create %{item}"
        />
      </ReferenceInput>
    </div>
  );
};

const ContactPersonalInformationInputs = () => {
  const { getValues, setValue } = useFormContext();

  // set first and last name based on email
  const handleEmailChange = (email: string) => {
    const { first_name, last_name } = getValues();
    if (first_name || last_name || !email) return;
    const [first, last] = email.split("@")[0].split(".");
    setValue("first_name", first.charAt(0).toUpperCase() + first.slice(1));
    setValue(
      "last_name",
      last ? last.charAt(0).toUpperCase() + last.slice(1) : "",
    );
  };

  const handleEmailPaste: React.ClipboardEventHandler<
    HTMLTextAreaElement | HTMLInputElement
  > = (e) => {
    const email = e.clipboardData?.getData("text/plain");
    handleEmailChange(email);
  };

  const handleEmailBlur = (
    e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    const email = e.target.value;
    handleEmailChange(email);
  };

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Personal info</h6>
      <ArrayInput
        source="email_jsonb"
        label="Email addresses"
        helperText={false}
      >
        <SimpleFormIterator inline disableReordering>
          <TextInput
            source="email"
            className="w-full"
            helperText={false}
            validate={email()}
            onPaste={handleEmailPaste}
            onBlur={handleEmailBlur}
          />
          <SelectInput
            source="type"
            helperText={false}
            optionText="id"
            choices={personalInfoTypes}
            defaultValue="Work"
            className="w-24 min-w-24"
          />
        </SimpleFormIterator>
      </ArrayInput>
      <ArrayInput source="phone_jsonb" label="Phone numbers" helperText={false}>
        <SimpleFormIterator inline disableReordering>
          <TextInput source="number" className="w-full" helperText={false} />
          <SelectInput
            source="type"
            helperText={false}
            optionText="id"
            choices={personalInfoTypes}
            defaultValue="Work"
            className="w-24 min-w-24"
          />
        </SimpleFormIterator>
      </ArrayInput>
      <TextInput
        source="linkedin_url"
        label="Linkedin URL"
        helperText={false}
        validate={isLinkedinUrl}
      />
    </div>
  );
};

const personalInfoTypes = [{ id: "Work" }, { id: "Home" }, { id: "Other" }];

const ContactMiscInputs = () => {
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Misc</h6>
      <TextInput
        source="background"
        label="Background info (bio, how you met, etc)"
        multiline
        helperText={false}
      />
      <BooleanInput source="has_newsletter" helperText={false} />
      <ReferenceInput
        reference="sales"
        source="sales_id"
        sort={{ field: "last_name", order: "ASC" }}
        filter={{
          "disabled@neq": true,
        }}
      >
        <SelectInput
          helperText={false}
          label="Account manager"
          optionText={saleOptionRenderer}
          validate={required()}
        />
      </ReferenceInput>
    </div>
  );
};

const saleOptionRenderer = (choice: Sale) =>
  `${choice.first_name} ${choice.last_name}`;
