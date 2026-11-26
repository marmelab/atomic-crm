import { Form } from "ra-core";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { StoryWrapper } from "@/test/StoryWrapper";

import ImageEditorField from "./ImageEditorField";

const createPicture = (width: number, height: number, type = "image/png") =>
  new Promise<File>((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#336699";
    context.fillRect(0, 0, width, height);
    canvas.toBlob(
      (blob) => resolve(new File([blob!], "picture.png", { type })),
      type,
    );
  });

const renderEditor = async ({
  record = {},
}: {
  record?: Record<string, unknown>;
} = {}) => {
  const onSubmit = vi.fn();
  const screen = await render(
    <StoryWrapper>
      <Form record={record} onSubmit={onSubmit}>
        <ImageEditorField
          source="logo"
          type="avatar"
          emptyText="AC"
          linkPosition="bottom"
        />
        <button type="submit">Save</button>
      </Form>
    </StoryWrapper>,
  );
  return { screen, onSubmit };
};

describe("ImageEditorField", () => {
  it("removes an existing picture when clicking delete", async () => {
    const picture = await createPicture(64, 64);
    const { screen, onSubmit } = await renderEditor({
      record: {
        id: 1,
        logo: { src: URL.createObjectURL(picture), title: "picture.png" },
      },
    });

    await screen.getByRole("button", { name: "Change" }).click();
    await screen.getByRole("button", { name: "Delete" }).click();

    await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
    await expect.element(screen.getByText("AC")).toBeVisible();
    await screen.getByRole("button", { name: "Save" }).click();
    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].logo).toBeNull();
  });
});
