/* eslint-disable react-refresh/only-export-components */
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'shine-sweep bg-[#171412] text-[#fafaf8] shadow-[0_24px_48px_-26px_rgba(23,20,18,0.58)] hover:-translate-y-1 hover:bg-[#241f1a] hover:shadow-[var(--shadow-3d)] active:translate-y-0 disabled:bg-stone-300 disabled:text-stone-500',
  secondary:
    'border border-[#d9d0c4] bg-white text-[#171412] hover:-translate-y-1 hover:border-[#d89a28] hover:text-[#171412] hover:shadow-[0_24px_50px_-30px_rgba(216,154,40,0.42)] active:translate-y-0 disabled:border-stone-200 disabled:bg-stone-100 disabled:text-stone-400',
  ghost:
    'bg-transparent text-[#171412] hover:bg-white/70 hover:shadow-[0_18px_36px_-24px_rgba(23,20,18,0.22)] disabled:text-stone-400',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-4 py-2.5 text-sm',
  md: 'px-5 py-3 text-sm',
  lg: 'px-6 py-4 text-base',
}

export function buttonClassName({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  className?: string
}) {
  return [
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition duration-300 disabled:cursor-not-allowed disabled:shadow-none',
    variantClasses[variant],
    sizeClasses[size],
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, size, fullWidth, className })}
      {...props}
    >
      {children}
    </button>
  )
}
