"use client"

import * as React from "react"
import { RiEyeLine, RiEyeOffLine } from "@remixicon/react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * Parol maydoni — ko'z tugmasi bilan (ko'rsatish / yashirish).
 *
 * Panelda HAMMA maxfiy maydon shu: login, parol almashtirish, foydalanuvchi
 * paroli, POS paroli, bot tokeni. Ko'z — xato terilganini ko'rish uchun
 * (ayniqsa telefonda va uzun tokenda); aks holda odam «parol noto'g'ri»
 * javobini olib, sababini bilmay qoladi.
 *
 * Edge'ning o'z ko'z belgisi (`::-ms-reveal`) yashiriladi — ikkita ko'z
 * chiqmasin.
 */
function PasswordInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = React.useState(false)
  const Icon = visible ? RiEyeOffLine : RiEyeLine

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("pr-9 [&::-ms-reveal]:hidden", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        disabled={props.disabled}
        aria-label={visible ? "Parolni yashirish" : "Parolni ko‘rsatish"}
        aria-pressed={visible}
        title={visible ? "Yashirish" : "Ko‘rsatish"}
        className="absolute inset-y-0 right-0 grid w-9 place-items-center rounded-r-lg text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
      >
        <Icon className="size-4" />
      </button>
    </div>
  )
}

export { PasswordInput }
