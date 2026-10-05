import { render } from "vitest-browser-react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

it("ToggleGroup forwards orientation to the Base UI primitive", async () => {
  // orientation only reaches the DOM through the wrapper's own data attribute, so
  // assert the behaviour it drives instead: vertical groups navigate with ArrowDown.
  const screen = await render(
    <ToggleGroup orientation="vertical">
      <ToggleGroupItem value="a">A</ToggleGroupItem>
      <ToggleGroupItem value="b">B</ToggleGroupItem>
    </ToggleGroup>
  )
  const [first, second] = Array.from(
    screen.container.querySelectorAll('[data-slot="toggle-group-item"]')
  ) as HTMLElement[]
  first.focus()
  first.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
  )
  await new Promise((r) => requestAnimationFrame(r))
  expect(document.activeElement).toBe(second)
})
