import { render } from "vitest-browser-react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

it("Tabs forwards orientation to the Base UI primitive", async () => {
  const screen = await render(
    <Tabs orientation="vertical" defaultValue="a">
      <TabsList>
        <TabsTrigger value="a">A</TabsTrigger>
        <TabsTrigger value="b">B</TabsTrigger>
      </TabsList>
    </Tabs>
  )
  const root = screen.container.querySelector('[data-slot="tabs"]')!
  expect(root.getAttribute("data-orientation")).toBe("vertical")
  // the tablist is what Base UI drives from the root's orientation
  expect(
    root.querySelector('[role="tablist"]')!.getAttribute("aria-orientation")
  ).toBe("vertical")
})
