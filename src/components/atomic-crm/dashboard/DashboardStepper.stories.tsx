import type { Meta } from "@storybook/react-vite";

import { StoryWrapper } from "@/test/StoryWrapper";
import { DashboardStepper } from "./DashboardStepper";

const meta = {
  title: "Atomic CRM/Dashboard/Dashboard Stepper",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

export const FirstStep = () => (
  <StoryWrapper>
    <DashboardStepper step={1} />
  </StoryWrapper>
);
