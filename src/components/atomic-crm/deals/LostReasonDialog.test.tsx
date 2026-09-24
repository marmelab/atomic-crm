import { I18nContextProvider } from "ra-core";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { i18nProvider } from "../providers/commons/i18nProvider";
import { LostReasonDialog } from "./LostReasonDialog";

// the dialog renders in a portal, so query the whole page
const renderDialog = async () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  await i18nProvider.changeLocale("en");
  await render(
    <I18nContextProvider value={i18nProvider}>
      <LostReasonDialog open onConfirm={onConfirm} onCancel={onCancel} />
    </I18nContextProvider>,
  );
  return { onConfirm, onCancel };
};

describe("LostReasonDialog", () => {
  it("blocks marking the deal as lost until a reason is given", async () => {
    const { onConfirm } = await renderDialog();
    const confirm = page.getByRole("button", { name: "Mark as lost" });

    await expect.element(confirm).toBeDisabled();
    await userEvent.type(
      page.getByRole("textbox", { name: "Why was this deal lost?" }),
      "   ",
    );
    await expect.element(confirm).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("submits the trimmed reason", async () => {
    const { onConfirm } = await renderDialog();

    await userEvent.type(
      page.getByRole("textbox", { name: "Why was this deal lost?" }),
      "  Budget cut  ",
    );
    await page.getByRole("button", { name: "Mark as lost" }).click();

    expect(onConfirm).toHaveBeenCalledWith("Budget cut");
  });

  it("cancels without a reason", async () => {
    const { onConfirm, onCancel } = await renderDialog();

    await page.getByRole("button", { name: "Cancel" }).click();

    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
