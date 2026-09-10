import type { Meta } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { useState } from "react";
import { TaskCreateSheet } from "./TaskCreateSheet";
import { StoryWrapper, buildContact } from "@/test/StoryWrapper";
const meta = {
  title: "Atomic CRM/Tasks/TaskCreateSheet",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

const defaultData = {
  contacts: [
    buildContact({
      first_name: "Ada",
      id: 1,
      last_name: "Lovelace",
    }),
    buildContact({
      first_name: "Grace",
      id: 2,
      last_name: "Hopper",
    }),
  ],
};
export const Mobile = ({
  children,
  data = defaultData,
  dataProvider,
}: {
  children?: ReactNode;
  data?: any;
  dataProvider?: Parameters<typeof StoryWrapper>[0]["dataProvider"];
}) => {
  const [open, setOpen] = useState(true);
  return (
    <StoryWrapper data={data} dataProvider={dataProvider}>
      <TaskCreateSheet open={open} onOpenChange={setOpen} />
      {children}
    </StoryWrapper>
  );
};
Mobile.globals = {
  viewport: { value: "mobile1", isRotated: false },
};
