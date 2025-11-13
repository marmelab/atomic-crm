import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  )
}

/**
 * Simple hash function to generate a number from a string
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash)
}

const colorClasses = [
  "bg-[color:var(--avatar-0)]",
  "bg-[color:var(--avatar-1)]",
  "bg-[color:var(--avatar-2)]",
  "bg-[color:var(--avatar-3)]",
  "bg-[color:var(--avatar-4)]",
  "bg-[color:var(--avatar-5)]",
  "bg-[color:var(--avatar-6)]",
  "bg-[color:var(--avatar-7)]",
  "bg-[color:var(--avatar-8)]",
  "bg-[color:var(--avatar-9)]",
]

function getAvatarColorClass(children: React.ReactNode): string {
  // Extract text content from children
  let childText: string | undefined
  if (typeof children === "string") {
    childText = children
  } else if (Array.isArray(children)) {
    // Handle array of children (e.g., multiple text nodes)
    childText = children.filter((child) => typeof child === "string").join("")
  } else if (
    React.isValidElement(children) &&
    typeof (children.props as any).children === "string"
  ) {
    childText = (children.props as any).children
  }
  if (!childText) return "bg-muted text-muted-foreground"

  return colorClasses[hashString(childText) % colorClasses.length]
}

function AvatarFallback({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full",
        className,
        getAvatarColorClass(children)
      )}
      {...props}
    >
      {children}
    </AvatarPrimitive.Fallback>
  )
}

export { Avatar, AvatarImage, AvatarFallback }
