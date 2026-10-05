import { afterEach, vi } from "vitest"
import { render } from "vitest-browser-react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

afterEach(() => {
  vi.useRealTimers()
})

it("opens without waiting when no provider wraps it", async () => {
  // Base UI falls back to a 600ms open delay when nothing provides one, and that
  // delay runs on setTimeout. With setTimeout frozen, only an instant open can
  // show the tooltip, whatever the runner load (expect.element polls on real timers).
  vi.useFakeTimers({ toFake: ["setTimeout"] })

  const screen = await render(
    <Tooltip>
      <TooltipTrigger render={<button type="button" />}>
        Hover me
      </TooltipTrigger>
      <TooltipContent>Helpful</TooltipContent>
    </Tooltip>
  )

  await screen.getByRole("button", { name: "Hover me" }).hover()

  await expect.element(screen.getByText("Helpful")).toBeVisible()
})
