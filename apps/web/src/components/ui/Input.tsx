import React from 'react'
import { clsx } from 'clsx'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className,
  id,
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={inputId} className="text-sm font-bold text-bq-ink2">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={clsx(
          'flex h-11 w-full rounded-bq-btn border-2 border-bq-ink bg-bq-inset px-3 py-2 text-base text-bq-ink ring-offset-bq-paper file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-bq-ink3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bq-sapphire focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-bq-ruby focus-visible:ring-bq-ruby',
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-sm text-bq-ruby">{error}</p>
      )}
    </div>
  )
}
