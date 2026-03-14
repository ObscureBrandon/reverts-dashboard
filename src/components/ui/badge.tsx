import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

type BadgeTone = "brand" | "success" | "warning" | "danger" | "info" | "neutral"
type BadgeKind = "status" | "attribute" | "meta"
type BadgeEmphasis = "soft" | "solid" | "outline"
type LegacyBadgeVariant = "default" | "secondary" | "destructive" | "outline" | "ghost" | "link"

const badgeVariants = cva(
  "inline-flex min-h-5 w-fit shrink-0 items-center justify-center overflow-hidden rounded-full border px-2 py-0.5 text-[11px] leading-4 whitespace-nowrap transition-[color,background-color,border-color,box-shadow,opacity] [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [a&]:hover:opacity-90",
  {
    variants: {
      tone: {
        brand: "",
        success: "",
        warning: "",
        danger: "",
        info: "",
        neutral: "",
      },
      kind: {
        status: "gap-1.5 font-medium [&>svg]:size-3.5",
        attribute: "gap-1.5 font-medium [&>svg]:size-3.5",
        meta: "gap-1 font-normal [&>svg]:size-3",
      },
      emphasis: {
        soft: "",
        solid: "shadow-xs",
        outline: "bg-transparent",
      },
      legacyVariant: {
        none: "",
        ghost: "border-transparent bg-transparent text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "border-transparent bg-transparent px-0 text-brand-accent-text underline-offset-4 [a&]:hover:underline",
      },
    },
    compoundVariants: [
      { tone: "brand", emphasis: "soft", className: "border-brand-accent-border bg-brand-accent-soft text-brand-accent-text" },
      { tone: "brand", emphasis: "solid", className: "border-brand-accent-solid bg-brand-accent-solid text-brand-accent-contrast" },
      { tone: "brand", emphasis: "outline", className: "border-brand-accent-border text-brand-accent-text" },
      { tone: "success", emphasis: "soft", className: "border-status-success-border bg-status-success-soft text-status-success-text" },
      { tone: "success", emphasis: "solid", className: "border-status-success-solid bg-status-success-solid text-status-success-contrast" },
      { tone: "success", emphasis: "outline", className: "border-status-success-border text-status-success-text" },
      { tone: "warning", emphasis: "soft", className: "border-status-warning-border bg-status-warning-soft text-status-warning-text" },
      { tone: "warning", emphasis: "solid", className: "border-status-warning-solid bg-status-warning-solid text-status-warning-contrast" },
      { tone: "warning", emphasis: "outline", className: "border-status-warning-border text-status-warning-text" },
      { tone: "danger", emphasis: "soft", className: "border-status-danger-border bg-status-danger-soft text-status-danger-text" },
      { tone: "danger", emphasis: "solid", className: "border-status-danger-solid bg-status-danger-solid text-status-danger-contrast" },
      { tone: "danger", emphasis: "outline", className: "border-status-danger-border text-status-danger-text" },
      { tone: "info", emphasis: "soft", className: "border-status-info-border bg-status-info-soft text-status-info-text" },
      { tone: "info", emphasis: "solid", className: "border-status-info-solid bg-status-info-solid text-status-info-contrast" },
      { tone: "info", emphasis: "outline", className: "border-status-info-border text-status-info-text" },
      { tone: "neutral", emphasis: "soft", className: "border-status-neutral-border bg-status-neutral-soft text-status-neutral-text" },
      { tone: "neutral", emphasis: "solid", className: "border-status-neutral-solid bg-status-neutral-solid text-status-neutral-contrast" },
      { tone: "neutral", emphasis: "outline", className: "border-status-neutral-border text-status-neutral-text" },
      { kind: "meta", emphasis: "solid", className: "font-medium" },
    ],
    defaultVariants: {
      tone: "neutral",
      kind: "status",
      emphasis: "soft",
      legacyVariant: "none",
    },
  }
)

function resolveLegacyVariant(variant: LegacyBadgeVariant) {
  switch (variant) {
    case "default":
      return { tone: "brand" as BadgeTone, kind: "status" as BadgeKind, emphasis: "solid" as BadgeEmphasis, legacyVariant: "none" as const }
    case "secondary":
      return { tone: "neutral" as BadgeTone, kind: "status" as BadgeKind, emphasis: "soft" as BadgeEmphasis, legacyVariant: "none" as const }
    case "destructive":
      return { tone: "danger" as BadgeTone, kind: "status" as BadgeKind, emphasis: "solid" as BadgeEmphasis, legacyVariant: "none" as const }
    case "outline":
      return { tone: "neutral" as BadgeTone, kind: "meta" as BadgeKind, emphasis: "outline" as BadgeEmphasis, legacyVariant: "none" as const }
    case "ghost":
      return { tone: "neutral" as BadgeTone, kind: "meta" as BadgeKind, emphasis: "outline" as BadgeEmphasis, legacyVariant: "ghost" as const }
    case "link":
      return { tone: "brand" as BadgeTone, kind: "meta" as BadgeKind, emphasis: "outline" as BadgeEmphasis, legacyVariant: "link" as const }
  }
}

function Badge({
  className,
  variant,
  tone,
  kind,
  emphasis,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  Omit<VariantProps<typeof badgeVariants>, "legacyVariant"> & {
    asChild?: boolean
    variant?: LegacyBadgeVariant
    tone?: BadgeTone
    kind?: BadgeKind
    emphasis?: BadgeEmphasis
  }) {
  const Comp = asChild ? Slot : "span"
  const legacyDefaults = resolveLegacyVariant(variant ?? "default")
  const isSemanticOverride = tone !== undefined || kind !== undefined || emphasis !== undefined
  const resolvedKind = kind ?? (isSemanticOverride ? "status" : legacyDefaults.kind)
  const resolvedTone = tone ?? (isSemanticOverride ? "neutral" : legacyDefaults.tone)
  const resolvedEmphasis = emphasis ?? (isSemanticOverride ? (resolvedKind === "meta" ? "outline" : "soft") : legacyDefaults.emphasis)
  const resolvedLegacyVariant = isSemanticOverride ? "none" : legacyDefaults.legacyVariant

  return (
    <Comp
      data-slot="badge"
      data-variant={variant ?? "default"}
      data-tone={resolvedTone}
      data-kind={resolvedKind}
      data-emphasis={resolvedEmphasis}
      className={cn(
        badgeVariants({
          tone: resolvedTone,
          kind: resolvedKind,
          emphasis: resolvedEmphasis,
          legacyVariant: resolvedLegacyVariant,
        }),
        className
      )}
      {...props}
    />
  )
}

export { Badge, badgeVariants, type BadgeEmphasis, type BadgeKind, type BadgeTone }
