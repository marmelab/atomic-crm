import type { Preview } from "@storybook/react-vite";

import "../src/index.css";

const preview: Preview = {
  // The CRM persists its react-query cache in localStorage and restores it on
  // mount: start each story empty, so it can't show the previous story's data.
  beforeEach() {
    localStorage.clear();
  },
  parameters: {
    layout: "fullscreen",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
