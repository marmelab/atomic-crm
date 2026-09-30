import { render } from "vitest-browser-react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

it("opens without waiting when no provider wraps it", async () => {
  const screen = await render(
    <Tooltip>
      <TooltipTrigger render={<button type="button" />}>
        Hover me
      </TooltipTrigger>
      <TooltipContent>Helpful</TooltipContent>
    </Tooltip>
  )

  await screen.getByRole("button", { name: "Hover me" }).hover()

  // Base UI falls back to a 600ms open delay when nothing provides one, so this
  // budget is what tells an instant tooltip from the default.
  await expect
    .element(screen.getByText("Helpful"), { timeout: 400 })
    .toBeVisible()
})
