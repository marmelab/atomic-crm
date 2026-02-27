import { required, useRecordContext, useTranslate } from "ra-core";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";
import { SelectInput } from "@/components/admin/select-input";
import { ArrayInput } from "@/components/admin/array-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";

import ImageEditorField from "../misc/ImageEditorField";
import { isLinkedinUrl } from "../misc/isLinkedInUrl";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Company, Sale } from "../types";
import { getTranslatedCompanySizeLabel } from "./getTranslatedCompanySizeLabel";
import { sizes } from "./sizes";

const isUrl = (url: string) => {
  if (!url) return;
  const UrlRegex = new RegExp(
    /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([-.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/i,
  );
  if (!UrlRegex.test(url)) {
    return {
      message: "crm.validation.invalid_url",
      args: { _: "Must be a valid URL" },
    };
  }
};

export const CompanyInputs = () => {
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-col gap-4 p-1">
      <CompanyDisplayInputs />
      <div className={`flex gap-6 ${isMobile ? "flex-col" : "flex-row"}`}>
        <div className="flex flex-col gap-10 flex-1">
          <CompanyContactInputs />
          <CompanyContextInputs />
        </div>
        <Separator orientation={isMobile ? "horizontal" : "vertical"} />
        <div className="flex flex-col gap-8 flex-1">
          <CompanyAddressInputs />
          <CompanyAdditionalInformationInputs />
          <CompanyAccountManagerInput />
        </div>
      </div>
    </div>
  );
};

const CompanyDisplayInputs = () => {
  const translate = useTranslate();
  const record = useRecordContext<Company>();
  return (
    <div className="flex gap-4 flex-1 flex-row">
      <ImageEditorField
        source="logo"
        type="avatar"
        width={60}
        height={60}
        emptyText={record?.name.charAt(0)}
        linkPosition="bottom"
      />
      <TextInput
        source="name"
        className="w-full h-fit"
        validate={required()}
        helperText={false}
        label="resources.companies.fields.name"
        placeholder={translate("resources.companies.fields.name", {
          _: "Company name",
        })}
      />
    </div>
  );
};

const CompanyContactInputs = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("crm.companies.inputs.contact", { _: "Contact" })}
      </h6>
      <TextInput
        source="website"
        label="resources.companies.fields.website"
        helperText={false}
        validate={isUrl}
      />
      <TextInput
        source="linkedin_url"
        label="resources.companies.fields.linkedin_url"
        helperText={false}
        validate={isLinkedinUrl}
      />
      <TextInput
        source="phone_number"
        label="resources.companies.fields.phone_number"
        helperText={false}
      />
    </div>
  );
};

const CompanyContextInputs = () => {
  const translate = useTranslate();
  const { companySectors } = useConfigurationContext();
  const translatedSizes = sizes.map((size) => ({
    ...size,
    name: getTranslatedCompanySizeLabel(size, translate),
  }));
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("crm.companies.inputs.context", { _: "Context" })}
      </h6>
      <SelectInput
        source="sector"
        label="resources.companies.fields.sector"
        choices={companySectors}
        optionText="label"
        optionValue="value"
        helperText={false}
      />
      <SelectInput
        source="size"
        label="resources.companies.fields.size"
        choices={translatedSizes}
        helperText={false}
      />
      <TextInput
        source="revenue"
        label="resources.companies.fields.revenue"
        helperText={false}
      />
      <TextInput
        source="tax_identifier"
        label="resources.companies.fields.tax_identifier"
        helperText={false}
      />
    </div>
  );
};

const CompanyAddressInputs = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("crm.companies.inputs.address", { _: "Address" })}
      </h6>
      <TextInput
        source="address"
        label="resources.companies.fields.address"
        helperText={false}
      />
      <TextInput
        source="city"
        label="resources.companies.fields.city"
        helperText={false}
      />
      <TextInput
        source="zipcode"
        label="resources.companies.fields.zipcode"
        helperText={false}
      />
      <TextInput
        source="state_abbr"
        label="resources.companies.fields.state_abbr"
        helperText={false}
      />
      <TextInput
        source="country"
        label="resources.companies.fields.country"
        helperText={false}
      />
    </div>
  );
};

const CompanyAdditionalInformationInputs = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("crm.companies.inputs.additional_information", {
          _: "Additional information",
        })}
      </h6>
      <TextInput
        source="description"
        label="resources.companies.fields.description"
        multiline
        helperText={false}
      />
      <ArrayInput
        source="context_links"
        label="resources.companies.fields.context_links"
        helperText={false}
      >
        <SimpleFormIterator disableReordering fullWidth getItemLabel={false}>
          <TextInput
            source=""
            label={false}
            helperText={false}
            validate={isUrl}
          />
        </SimpleFormIterator>
      </ArrayInput>
    </div>
  );
};

const CompanyAccountManagerInput = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("crm.common.account_manager", { _: "Account manager" })}
      </h6>
      <ReferenceInput
        source="sales_id"
        reference="sales"
        filter={{
          "disabled@neq": true,
        }}
      >
        <SelectInput
          label="resources.companies.fields.sales_id"
          helperText={false}
          optionText={saleOptionRenderer}
        />
      </ReferenceInput>
    </div>
  );
};

const saleOptionRenderer = (choice: Sale) =>
  `${choice.first_name} ${choice.last_name}`;
