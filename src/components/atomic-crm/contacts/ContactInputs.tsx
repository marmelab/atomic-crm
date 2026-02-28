import { email, required, useTranslate } from "ra-core";
import type { FocusEvent, ClipboardEventHandler } from "react";
import { useFormContext } from "react-hook-form";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import { BooleanInput } from "@/components/admin/boolean-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";
import { RadioButtonGroupInput } from "@/components/admin/radio-button-group-input";
import { SelectInput } from "@/components/admin/select-input";
import { ArrayInput } from "@/components/admin/array-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";

import { isLinkedinUrl } from "../misc/isLinkedInUrl";
import { contactGender } from "./contactGender";
import type { Sale } from "../types";
import { Avatar } from "./Avatar";
import { AutocompleteCompanyInput } from "../companies/AutocompleteCompanyInput.tsx";

export const ContactInputs = () => {
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-col gap-2 p-1 relative md:static">
      <div className="absolute top-0 right-1 md:static">
        <Avatar />
      </div>
      <div className="flex gap-10 md:gap-6 flex-col md:flex-row">
        <div className="flex flex-col gap-10 flex-1">
          <ContactIdentityInputs />
          <ContactPositionInputs />
        </div>
        {isMobile ? null : (
          <Separator orientation="vertical" className="flex-shrink-0" />
        )}
        <div className="flex flex-col gap-10 flex-1">
          <ContactPersonalInformationInputs />
          <ContactMiscInputs />
        </div>
      </div>
    </div>
  );
};

const ContactIdentityInputs = () => {
  const translate = useTranslate();

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("crm.contacts.sections.identity", { _: "Identity" })}
      </h6>
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
  const translate = useTranslate();

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("crm.contacts.sections.position", { _: "Position" })}
      </h6>
      <TextInput source="title" helperText={false} />
      <ReferenceInput source="company_id" reference="companies" perPage={10}>
        <AutocompleteCompanyInput />
      </ReferenceInput>
    </div>
  );
};

const ContactPersonalInformationInputs = () => {
  const { getValues, setValue } = useFormContext();
  const translate = useTranslate();

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

  const handleEmailPaste: ClipboardEventHandler<
    HTMLTextAreaElement | HTMLInputElement
  > = (e) => {
    const email = e.clipboardData?.getData("text/plain");
    handleEmailChange(email);
  };

  const handleEmailBlur = (
    e: FocusEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    const email = e.target.value;
    handleEmailChange(email);
  };

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("crm.contacts.sections.personal_info", { _: "Personal info" })}
      </h6>
      <ArrayInput
        source="email_jsonb"
        label={translate("resources.contacts.fields.email_jsonb")}
        helperText={false}
      >
        <SimpleFormIterator
          inline
          disableReordering
          disableClear
          className="[&>ul>li]:border-b-0 [&>ul>li]:pb-0"
        >
          <TextInput
            source="email"
            className="w-full"
            helperText={false}
            label={false}
            placeholder={translate("ra.auth.email", { _: "Email" })}
            validate={email()}
            onPaste={handleEmailPaste}
            onBlur={handleEmailBlur}
          />
          <SelectInput
            source="type"
            helperText={false}
            label={false}
            optionText={(choice) => translate(choice.name, { _: choice.id })}
            choices={personalInfoTypes}
            defaultValue="Work"
            className="w-24 min-w-24"
          />
        </SimpleFormIterator>
      </ArrayInput>
      <ArrayInput
        source="phone_jsonb"
        label={translate("resources.contacts.fields.phone_jsonb")}
        helperText={false}
      >
        <SimpleFormIterator
          inline
          disableReordering
          disableClear
          className="[&>ul>li]:border-b-0 [&>ul>li]:pb-0"
        >
          <TextInput
            source="number"
            className="w-full"
            helperText={false}
            label={false}
            placeholder={translate("crm.contacts.phone_number", {
              _: "Phone number",
            })}
          />
          <SelectInput
            source="type"
            helperText={false}
            label={false}
            optionText={(choice) => translate(choice.name, { _: choice.id })}
            choices={personalInfoTypes}
            defaultValue="Work"
            className="w-24 min-w-24"
          />
        </SimpleFormIterator>
      </ArrayInput>
      <TextInput
        source="linkedin_url"
        label={translate("resources.contacts.fields.linkedin_url")}
        helperText={false}
        validate={isLinkedinUrl}
      />
    </div>
  );
};

const personalInfoTypes = [
  { id: "Work", name: "crm.contacts.personal_info_type.work" },
  { id: "Home", name: "crm.contacts.personal_info_type.home" },
  { id: "Other", name: "crm.contacts.personal_info_type.other" },
];

const ContactMiscInputs = () => {
  const translate = useTranslate();

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("crm.contacts.sections.misc", { _: "Misc" })}
      </h6>
      <TextInput
        source="background"
        label={translate("resources.contacts.fields.background")}
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
          label={translate("resources.contacts.fields.sales_id")}
          optionText={saleOptionRenderer}
          validate={required()}
        />
      </ReferenceInput>
    </div>
  );
};

const saleOptionRenderer = (choice: Sale) =>
  `${choice.first_name} ${choice.last_name}`;
