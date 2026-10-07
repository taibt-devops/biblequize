import React from 'react'
import { clsx } from 'clsx'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}) => {
  // Lữ Khách pressable button: ink outline, hard shadow, sinks 4px when pressed.
  const baseClasses = 'inline-flex items-center justify-center gap-2 rounded-bq-btn border-[3px] border-bq-ink font-bold shadow-bq-btn transition-[transform,box-shadow,filter] duration-75 active:translate-y-1 active:shadow-bq-btn-down focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-bq-sapphire focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none'
  
  const variantClasses = {
    primary: 'bg-bq-action text-bq-ink hover:brightness-105',
    secondary: 'bg-bq-leaf text-bq-ink hover:brightness-105',
    outline: 'bg-bq-white text-bq-ink hover:bg-bq-inset',
    ghost: 'border-transparent shadow-none text-bq-ink hover:bg-bq-inset active:translate-y-0 active:shadow-none'
  }
  
  const sizeClasses = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-11 px-5 text-base',
    lg: 'h-14 px-7 text-lg'
  }

  return (
    <button
      className={clsx(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
