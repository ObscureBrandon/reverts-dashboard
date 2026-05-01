"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ theme = "system", ...props }: ToasterProps) => {
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      position="bottom-left"
      closeButton
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        duration: Infinity,
        classNames: {
          toast: "group toast group-[.toaster]:border-border group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:shadow-lg",
          description: "!text-foreground",
          closeButton: "!bg-popover !border-border !text-muted-foreground hover:!bg-muted hover:!text-foreground",
          actionButton: "group-[.toast]:!bg-primary group-[.toast]:!text-primary-foreground group-[.toast]:!rounded-md group-[.toast]:!px-3 group-[.toast]:!py-1.5",
          cancelButton: "group-[.toast]:!bg-muted group-[.toast]:!text-muted-foreground group-[.toast]:!rounded-md",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as import("react").CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
