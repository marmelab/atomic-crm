import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { CimaBreakQuiz } from "./CimaBreakQuiz";

describe("CimaBreakQuiz", () => {
  it("opens and closes without leaving the widget stuck on screen", async () => {
    const screen = await render(<CimaBreakQuiz />);

    await expect.element(screen.getByRole("button", { name: /show cima quiz/i })).toBeInTheDocument();

    await screen.getByRole("button", { name: /show cima quiz/i }).click();

    await expect.element(screen.getByText(/ready for a focused break/i)).toBeInTheDocument();

    await screen.getByRole("button", { name: /^close$/i }).click();

    await expect.element(screen.getByRole("button", { name: /show cima quiz/i })).toBeInTheDocument();
    await expect.element(screen.getByText(/cima e3 break quiz/i)).not.toBeInTheDocument();
  });
});
