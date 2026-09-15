import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { StoryWrapper, buildContact } from "@/test/StoryWrapper";
import type { Db } from "../providers/fakerest/dataGenerator/types";
import { NoteCreateSheet } from "./NoteCreateSheet";

const contact = buildContact({
  first_name: "Ada",
  id: 1,
  last_name: "Lovelace",
});

// The sheet is controlled by its parent, so the test owns the open state.
const NoteCreateSheetHost = () => {
  const [open, setOpen] = useState(true);
  return <NoteCreateSheet open={open} onOpenChange={setOpen} />;
};

describe("NoteCreateSheet", () => {
  it("closes the sheet and confirms the creation when the contact refresh fails", async () => {
    // Arrange: the note create succeeds, the follow-up contact refresh does not.
    const screen = await render(
      <StoryWrapper
        data={{ contacts: [contact] } as Partial<Db>}
        dataProvider={{
          getOne: (resource: string) =>
            Promise.reject(new Error(`getOne("${resource}") is unavailable`)),
        }}
      >
        <NoteCreateSheetHost />
      </StoryWrapper>,
    );

    // Act
    await screen.getByPlaceholder("Add a note").fill("Called about onboarding");

    await screen.getByRole("combobox").click();
    await screen.getByText("Ada Lovelace").click();

    await screen.getByRole("button", { name: /^save$/i }).click();

    // Assert: the note exists, so the sheet must go away with a confirmation.
    // Leaving it open would invite a second Save, hence a duplicate note.
    await expect.element(screen.getByText("Note added")).toBeInTheDocument();
    await expect
      .element(screen.getByText("Create note"))
      .not.toBeInTheDocument();
  });
});
