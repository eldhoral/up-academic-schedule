'use client'

import * as SelectPrimitive from '@radix-ui/react-select'

export type SelectOption = { value: string; label: string }

/**
 * Custom-rendered dropdown replacing the native <select>. Native selects'
 * popup is OS chrome (Safari especially scrolls to keep the selected item in
 * view instead of always showing the list from the top) — not reachable by
 * CSS, so it can't be made to render consistently across browsers. This
 * renders its own popup instead, built on Radix's unstyled, accessible
 * listbox primitive (keyboard nav, focus, ARIA already handled) and skinned
 * to match the app's existing select styling exactly.
 *
 * Empty-string values are reserved by Radix to mean "show the placeholder" —
 * never add an option with value="". Pass `placeholder` instead.
 */
export function Select({
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder,
  name,
  required,
  disabled,
  className = '',
  id,
  ariaLabel,
}: {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  name?: string
  required?: boolean
  disabled?: boolean
  className?: string
  id?: string
  ariaLabel?: string
}) {
  return (
    <SelectPrimitive.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      name={name}
      required={required}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        className={`inline-flex items-center justify-between gap-[0.4rem] cursor-pointer disabled:cursor-default disabled:opacity-60 data-[placeholder]:text-[var(--tinta-3)] ${className}`}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon className="shrink-0 text-[var(--tinta-3)]">
          <ChevronIcon />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-[60] overflow-hidden bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] min-w-[var(--radix-select-trigger-width)]"
        >
          <SelectPrimitive.ScrollUpButton className="flex items-center justify-center h-[1.2rem] bg-[var(--lembar)] text-[var(--tinta-3)]">
            <ChevronIcon direction="up" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="p-[0.27rem] max-h-[16rem]">
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value}
                value={o.value}
                className="relative flex items-center gap-[0.4rem] pl-[1.7rem] pr-[0.8rem] py-[0.33rem] rounded-[var(--r-kecil)] text-[0.93rem] cursor-pointer select-none outline-none whitespace-nowrap data-[highlighted]:bg-[var(--cekung)] data-[state=checked]:text-[var(--biru)] data-[state=checked]:font-medium"
              >
                <SelectPrimitive.ItemIndicator className="absolute left-[0.5rem] inline-flex items-center text-[var(--biru)]">
                  <CheckIcon />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex items-center justify-center h-[1.2rem] bg-[var(--lembar)] text-[var(--tinta-3)]">
            <ChevronIcon direction="down" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

function ChevronIcon({ direction = 'down' }: { direction?: 'up' | 'down' }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
      style={{ transform: direction === 'up' ? 'rotate(180deg)' : undefined }}
    >
      <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
