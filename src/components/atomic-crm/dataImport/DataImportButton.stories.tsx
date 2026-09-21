import type { Meta } from "@storybook/react-vite";

import { StoryWrapper } from "@/test/StoryWrapper";
import { DataImportButton } from "./DataImportButton";
import type { ImportableResourceName } from "./useImportableResources";

const meta = {
  title: "Atomic CRM/Data Import/Data Import Button",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

export const AllResources = () => (
  <StoryWrapper>
    <DataImportButton />
  </StoryWrapper>
);

export const SingleResource = ({
  resource,
}: {
  resource: ImportableResourceName;
}) => (
  <StoryWrapper>
    <DataImportButton resource={resource} />
  </StoryWrapper>
);
