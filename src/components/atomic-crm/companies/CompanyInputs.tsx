import { required, useRecordContext } from "ra-core";
import { useWatch } from "react-hook-form";
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
import { sizes } from "./sizes";

const isUrl = (url: string) => {
  if (!url) return;
  const UrlRegex = new RegExp(
    /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([-.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/i,
  );
  if (!UrlRegex.test(url)) {
    return "URL invalide";
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
        placeholder="Nom de l'entreprise"
      />
    </div>
  );
};

const CompanyContactInputs = () => {
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Contact</h6>
      <WebsiteInputWithLogo />
      <TextInput
        source="linkedin_url"
        helperText={false}
        validate={isLinkedinUrl}
      />
      <TextInput source="phone_number" helperText={false} />
    </div>
  );
};

const WebsiteInputWithLogo = () => {
  const website: string | undefined = useWatch({ name: "website" });

  const domain = (() => {
    if (!website) return null;
    try {
      const url = website.startsWith("http") ? website : `https://${website}`;
      return new URL(url).hostname;
    } catch {
      return null;
    }
  })();

  return (
    <div className="flex items-center gap-2">
      <TextInput
        source="website"
        helperText={false}
        validate={isUrl}
        className="flex-1"
      />
      {domain && (
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
          alt=""
          className="w-8 h-8 rounded object-contain border shrink-0"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
    </div>
  );
};

const CompanyContextInputs = () => {
  const { companySectors, companyTypes } = useConfigurationContext();
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Contexte</h6>
      <SelectInput
        source="type"
        label="Type"
        choices={companyTypes}
        optionText="label"
        optionValue="value"
        helperText={false}
      />
      <SelectInput
        source="sector"
        choices={companySectors}
        optionText="label"
        optionValue="value"
        helperText={false}
      />
      <SelectInput source="size" choices={sizes} helperText={false} />
      <TextInput source="revenue" helperText={false} />
      <TextInput source="tax_identifier" helperText={false} />
    </div>
  );
};

const CompanyAddressInputs = () => {
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Adresse</h6>
      <TextInput source="address" helperText={false} />
      <TextInput source="city" helperText={false} />
      <TextInput source="zipcode" helperText={false} />
      <TextInput source="state_abbr" helperText={false} />
      <TextInput source="country" helperText={false} />
    </div>
  );
};

const CompanyAdditionalInformationInputs = () => {
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Informations complémentaires</h6>
      <TextInput source="description" multiline helperText={false} />
      <ArrayInput source="context_links" helperText={false}>
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
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Responsable de compte</h6>
      <ReferenceInput
        source="sales_id"
        reference="sales"
        filter={{
          "disabled@neq": true,
        }}
      >
        <SelectInput
          label="Responsable de compte"
          helperText={false}
          optionText={saleOptionRenderer}
        />
      </ReferenceInput>
    </div>
  );
};

const saleOptionRenderer = (choice: Sale) =>
  `${choice.first_name} ${choice.last_name}`;
