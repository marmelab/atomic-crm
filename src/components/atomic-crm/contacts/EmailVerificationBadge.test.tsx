import { render } from "vitest-browser-react";
import { EmailVerificationBadge } from "./EmailVerificationBadge";

describe("EmailVerificationBadge", () => {
  it("renders nothing when there is no verification", async () => {
    const screen = await render(<EmailVerificationBadge />);

    expect(screen.container.querySelector("[aria-label]")).toBeNull();
  });

  it("renders a status dot with an accessible label", async () => {
    const screen = await render(
      <EmailVerificationBadge
        verification={{
          status: "Valid",
          checkedAt: "2026-06-26T00:00:00.000Z",
        }}
      />,
    );

    await expect
      .element(screen.getByRole("img", { name: "Email verification: Valid" }))
      .toBeInTheDocument();
  });

  it("shows the status and diagnosis in the tooltip", async () => {
    const screen = await render(
      <EmailVerificationBadge
        verification={{
          status: "Invalid",
          diagnosis: "Mailbox does not exist",
          checkedAt: "2026-06-26T00:00:00.000Z",
        }}
      />,
    );

    await expect
      .element(screen.getByText("Invalid — Mailbox does not exist"))
      .toBeInTheDocument();
  });
});
