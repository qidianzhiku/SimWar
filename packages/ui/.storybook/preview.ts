import type { Preview } from "@storybook/react-vite";
import "../src/tokens.css";
import "../src/styles.css";

const preview: Preview = {
  parameters: {
    a11y: {
      test: "error"
    },
    layout: "padded",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    }
  },
  tags: ["autodocs"]
};

export default preview;
