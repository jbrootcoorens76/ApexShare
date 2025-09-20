/**
 * Loading Spinner Component
 *
 * A reusable loading spinner with multiple sizes and optional message.
 * Optimized for accessibility and smooth animations.
 */

import React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  message?: string
  className?: string
  fullScreen?: boolean
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  message,
  className,
  fullScreen = false,
}) => {
  const spinner = (
    <div className="flex flex-col items-center justify-center space-y-2">
      <Loader2
        className={cn('animate-spin text-primary-600', sizeClasses[size], className)}
        aria-hidden="true"
      />
      {message && (
        <p className="text-sm text-gray-600 animate-pulse" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
        {spinner}
      </div>
    )
  }

  return spinner
}

/**
 * Inline loading spinner for buttons and small spaces
 */
export const InlineSpinner: React.FC<{ size?: 'sm' | 'md'; className?: string }> = ({
  size = 'sm',
  className
}) => (
  <Loader2
    className={cn('animate-spin', sizeClasses[size], className)}
    aria-hidden="true"
  />
)