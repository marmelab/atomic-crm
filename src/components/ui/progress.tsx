import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="bg-primary h-full w-full flex-1 transition-all"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

// @TODO: Replace me by shadcn-admin-kit progressAuto component when it will be released
function ProgressAuto(
  props: React.ComponentProps<typeof ProgressPrimitive.Root>
) {
  const [progress, setProgress] = React.useState(20)

  React.useEffect(() => {
    const timer = setTimeout(
      () => setProgress((prev) => (prev + 20) % 100),
      1500
    )
    return () => clearTimeout(timer)
  }, [progress])

  return <Progress {...props} value={progress} />
}

export { Progress, ProgressAuto }
