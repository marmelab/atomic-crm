import { render } from "vitest-browser-react";
import {
  ContactEditBasic,
  ContactEditWithEmailsAndPhones,
} from "./ContactEdit.stories";
import {
  ContactEditBasic as ContactEditMobileBasic,
  ContactEditWithEmailsAndPhones as ContactEditMobileWithEmailsAndPhones,
} from "./ContactEdit.mobile.stories";
import { page } from "vitest/browser";

describe("ContactEdit", () => {
  describe("desktop", () => {
    beforeAll(() => {
      page.viewport(1600, 900);
    });

    it("shows empty email and phone inputs when the contact has none", async () => {
      const screen = await render(<ContactEditBasic silent />);

      // The form should display one empty email placeholder input
      await expect
        .element(screen.getByPlaceholder("Email"))
        .toBeInTheDocument();

      // The form should display one empty phone placeholder input
      await expect
        .element(screen.getByPlaceholder("Phone number"))
        .toBeInTheDocument();
    });

    it("does not submit empty email and phone entries", async () => {
      const updateMock = vi.fn().mockResolvedValue({ data: {} });
      const screen = await render(
        <ContactEditBasic
          silent
          dataProvider={{
            update: updateMock,
          }}
        />,
      );

      // Wait for the form to load
      await expect
        .element(screen.getByPlaceholder("Email"))
        .toBeInTheDocument();

      // Submit without filling anything
      await screen.getByRole("button", { name: /^save$/i }).click();
      await expect
        .poll(() => screen.getByText("Element updated"))
        .toBeInTheDocument();

      await screen.getByLabelText("Close toast").click();

      // Verify the transform cleaned up the empty arrays
      expect(updateMock).toBeCalledTimes(1);
      expect(updateMock).toBeCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            email_jsonb: null,
            phone_jsonb: null,
          }),
        }),
      );
    });

    it("submits only filled email and phone entries, stripping empty ones", async () => {
      const updateMock = vi.fn().mockResolvedValue({ data: {} });

      const screen = await render(
        <ContactEditBasic
          dataProvider={{
            update: updateMock,
          }}
          silent
        />,
      );

      // Wait for the form to load and fill in the email
      const emailInput = screen.getByPlaceholder("Email");
      await expect.element(emailInput).toBeInTheDocument();
      await emailInput.fill("ada@example.com");

      // Leave the phone input empty and submit
      await screen.getByRole("button", { name: /^save$/i }).click();
      await expect
        .poll(() => screen.getByText("Element updated"))
        .toBeInTheDocument();

      await screen.getByLabelText("Close toast").click();

      // Wait for the update call to complete
      await expect.poll(() => updateMock.mock.calls.length).toBe(1);

      expect(updateMock).toBeCalledTimes(1);

      expect(updateMock).toBeCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            email_jsonb: [{ email: "ada@example.com", type: "Work" }],
            phone_jsonb: null,
          }),
        }),
      );
    });

    it("preserves existing email and phone entries on edit", async () => {
      const updateMock = vi.fn().mockResolvedValue({ data: {} });
      const screen = await render(
        <ContactEditWithEmailsAndPhones
          silent
          dataProvider={{ update: updateMock }}
        />,
      );

      // Wait for existing values to appear
      const emailInput = screen.getByPlaceholder("Email");
      await expect.element(emailInput).toHaveValue("ada@example.com");

      const phoneInput = screen.getByPlaceholder("Phone number");
      await expect.element(phoneInput).toHaveValue("0123456789");

      // Submit without changes
      await screen.getByRole("button", { name: /^save$/i }).click();
      await expect
        .poll(() => screen.getByText("Element updated"))
        .toBeInTheDocument();

      await screen.getByLabelText("Close toast").click();

      // Wait for the update call to complete
      expect(updateMock).toBeCalledTimes(1);

      // Verify existing data is preserved through the transform
      expect(updateMock).toBeCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            email_jsonb: [{ email: "ada@example.com", type: "Work" }],
            phone_jsonb: [{ number: "0123456789", type: "Work" }],
          }),
        }),
      );
    });

    it("clears the email type from the keyboard and with the mouse", async () => {
      // Arrange: the email type select holds "Work", so its clear button is shown.
      const screen = await render(<ContactEditWithEmailsAndPhones silent />);
      await expect
        .element(screen.getByPlaceholder("Email"))
        .toHaveValue("ada@example.com");
      const clearButton = screen
        .getByRole("button", { name: "Clear value" })
        .first();
      await expect.element(clearButton).toBeInTheDocument();

      // Assert: it is a real button, reachable with a keyboard. It used to be a
      // div[role=button] nested inside the trigger, which no Tab could reach.
      const element = clearButton.element() as HTMLElement;
      expect(element.tagName).toBe("BUTTON");
      element.focus();
      expect(document.activeElement).toBe(element);

      // Act & assert: pressing it clears the value, so the button goes away with
      // it. While it sat inside the trigger, Base UI opened the select on the
      // mousedown and the popup swallowed the rest of the gesture instead.
      await clearButton.click();
      // assert on the element, not the locator: the phone row has a clear button
      // of its own, which the locator would resolve to once this one is gone.
      await expect.poll(() => element.isConnected).toBe(false);
      expect(document.querySelector('[data-slot="select-content"]')).toBeNull();
    });
  });
  describe("mobile", () => {
    beforeAll(() => {
      page.viewport(375, 667);
    });

    it("shows empty email and phone inputs when the contact has none on mobile", async () => {
      const screen = await render(<ContactEditMobileBasic silent />);

      await screen.getByRole("button", { name: /edit/i }).click();
      // The form should display one empty email placeholder input
      await expect
        .element(screen.getByPlaceholder("Email"))
        .toBeInTheDocument();

      // The form should display one empty phone placeholder input
      await expect
        .element(screen.getByPlaceholder("Phone number"))
        .toBeInTheDocument();
    });

    it("does not submit empty email and phone entries on mobile", async () => {
      const updateMock = vi.fn().mockResolvedValue({ data: {} });
      const screen = await render(
        <ContactEditMobileBasic
          silent
          dataProvider={{
            update: updateMock,
          }}
        />,
      );
      await screen.getByRole("button", { name: /edit/i }).click();

      // Wait for the form to load
      await expect
        .element(screen.getByPlaceholder("Email"))
        .toBeInTheDocument();

      // Submit without filling anything
      await screen.getByRole("button", { name: /^save$/i }).click();
      await expect
        .poll(() => screen.getByText("Element updated"))
        .toBeInTheDocument();

      await screen.getByLabelText("Close toast").click();

      // Verify the transform cleaned up the empty arrays
      expect(updateMock).toBeCalledTimes(1);
      expect(updateMock).toBeCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            email_jsonb: null,
            phone_jsonb: null,
          }),
        }),
      );
    });

    it("submits only filled email and phone entries, stripping empty ones on mobile", async () => {
      const updateMock = vi.fn().mockResolvedValue({ data: {} });

      const screen = await render(
        <ContactEditMobileBasic
          dataProvider={{
            update: updateMock,
          }}
          silent
        />,
      );
      await screen.getByRole("button", { name: /edit/i }).click();

      // Wait for the edit sheet form to render before interacting
      const emailInput = screen.getByPlaceholder("Email");
      await expect.element(emailInput).toBeInTheDocument();
      await emailInput.fill("ada@example.com");

      // Leave the phone input empty and submit
      await screen.getByRole("button", { name: /^save$/i }).click();
      await expect
        .poll(() => screen.getByText("Element updated"))
        .toBeInTheDocument();

      await screen.getByLabelText("Close toast").click();

      // Wait for the update call to complete
      await expect.poll(() => updateMock.mock.calls.length).toBe(1);

      expect(updateMock).toBeCalledTimes(1);

      expect(updateMock).toBeCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            email_jsonb: [{ email: "ada@example.com", type: "Work" }],
            phone_jsonb: null,
          }),
        }),
      );
    });

    it("preserves existing email and phone entries on edit on mobile", async () => {
      const updateMock = vi.fn().mockResolvedValue({ data: {} });
      const screen = await render(
        <ContactEditMobileWithEmailsAndPhones
          silent
          dataProvider={{ update: updateMock }}
        />,
      );
      await screen.getByRole("button", { name: /edit/i }).click();

      // Wait for existing values to appear
      const emailInput = screen.getByPlaceholder("Email");
      await expect.element(emailInput).toHaveValue("ada@example.com");

      const phoneInput = screen.getByPlaceholder("Phone number");
      await expect.element(phoneInput).toHaveValue("0123456789");

      // Submit without changes
      await screen.getByRole("button", { name: /^save$/i }).click();
      await expect
        .poll(() => screen.getByText("Element updated"))
        .toBeInTheDocument();

      await screen.getByLabelText("Close toast").click();

      // Wait for the update call to complete
      expect(updateMock).toBeCalledTimes(1);

      // Verify existing data is preserved through the transform
      expect(updateMock).toBeCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            email_jsonb: [{ email: "ada@example.com", type: "Work" }],
            phone_jsonb: [{ number: "0123456789", type: "Work" }],
          }),
        }),
      );
    });
  });
});
