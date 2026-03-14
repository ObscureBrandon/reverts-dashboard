"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl"

const avatarSizeClasses: Record<AvatarSize, string> = {
  xs: "size-5",
  sm: "size-6",
  md: "size-8",
  lg: "size-10",
  xl: "size-16",
}

const avatarGroupCountClasses: Record<AvatarSize, string> = {
  xs: "size-5 text-[10px] [&>svg]:size-2.5",
  sm: "size-6 text-xs [&>svg]:size-3",
  md: "size-8 text-sm [&>svg]:size-4",
  lg: "size-10 text-base [&>svg]:size-5",
  xl: "size-16 text-xl [&>svg]:size-6",
}

function getAvatarInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function Avatar({
  className,
  size = "md",
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: AvatarSize | "default"
}) {
  const resolvedSize = size === "default" ? "md" : size

  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={resolvedSize}
      className={cn(
        "group/avatar relative flex shrink-0 overflow-hidden rounded-full select-none",
        avatarSizeClasses[resolvedSize],
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

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted text-muted-foreground flex size-full items-center justify-center rounded-full",
        "group-data-[size=xs]/avatar:text-[10px] group-data-[size=sm]/avatar:text-xs group-data-[size=md]/avatar:text-sm group-data-[size=lg]/avatar:text-base group-data-[size=xl]/avatar:text-xl",
        className
      )}
      {...props}
    />
  )
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "bg-primary text-primary-foreground ring-background absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full ring-2 select-none",
        "group-data-[size=xs]/avatar:size-2 group-data-[size=xs]/avatar:[&>svg]:hidden",
        "group-data-[size=sm]/avatar:size-2.5 group-data-[size=sm]/avatar:[&>svg]:size-2",
        "group-data-[size=md]/avatar:size-3 group-data-[size=md]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3.5 group-data-[size=lg]/avatar:[&>svg]:size-2.5",
        "group-data-[size=xl]/avatar:size-5 group-data-[size=xl]/avatar:[&>svg]:size-3",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "*:data-[slot=avatar]:ring-background group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "bg-muted text-muted-foreground ring-background relative flex shrink-0 items-center justify-center rounded-full ring-2",
        avatarGroupCountClasses.md,
        "group-has-data-[size=xs]/avatar-group:size-5 group-has-data-[size=xs]/avatar-group:text-[10px] group-has-data-[size=xs]/avatar-group:[&>svg]:size-2.5",
        "group-has-data-[size=sm]/avatar-group:size-6 group-has-data-[size=sm]/avatar-group:text-xs group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        "group-has-data-[size=md]/avatar-group:size-8 group-has-data-[size=md]/avatar-group:text-sm group-has-data-[size=md]/avatar-group:[&>svg]:size-4",
        "group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=lg]/avatar-group:text-base group-has-data-[size=lg]/avatar-group:[&>svg]:size-5",
        "group-has-data-[size=xl]/avatar-group:size-16 group-has-data-[size=xl]/avatar-group:text-xl group-has-data-[size=xl]/avatar-group:[&>svg]:size-6",
        className
      )}
      {...props}
    />
  )
}

function UserAvatar({
  className,
  fallbackClassName,
  imageClassName,
  name,
  size = "md",
  src,
  ...props
}: Omit<React.ComponentProps<typeof AvatarPrimitive.Root>, "children"> & {
  fallbackClassName?: string
  imageClassName?: string
  name: string
  size?: AvatarSize | "default"
  src?: string | null
}) {
  const [imageError, setImageError] = React.useState(false)

  React.useEffect(() => {
    setImageError(false)
  }, [src])

  return (
    <Avatar size={size} className={className} {...props}>
      {!imageError && src ? (
        <AvatarImage
          src={src}
          alt={`${name}'s avatar`}
          className={imageClassName}
          onError={() => setImageError(true)}
        />
      ) : null}
      <AvatarFallback className={cn("font-semibold", fallbackClassName)}>
        {getAvatarInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  UserAvatar,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
  getAvatarInitials,
  type AvatarSize,
}
