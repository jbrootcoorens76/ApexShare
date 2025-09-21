/**
 * Login Page Component
 *
 * Authentication form with email/password login and demo access.
 * Features responsive design and accessibility support.
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, LogIn } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'

import { useAuth } from '@/hooks/useAuth'
import { InlineSpinner } from '@/components/ui/LoadingSpinner'
import { cn } from '@/utils/cn'

interface LoginForm {
  email: string
  password: string
  rememberMe: boolean
}

export const LoginPage: React.FC = () => {
  const [form, setForm] = useState<LoginForm>({
    email: '',
    password: '',
    rememberMe: false,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Partial<LoginForm>>({})

  const { login, isLoading, error, clearError } = useAuth()
  const navigate = useNavigate()

  // Demo accounts for easy access
  const demoAccounts = [
    { role: 'trainer', email: 'trainer@apexshare.be', password: 'demo123' },
    { role: 'student', email: 'student@apexshare.be', password: 'demo123' },
  ]

  const validateForm = (): boolean => {
    const newErrors: Partial<LoginForm> = {}

    if (!form.email) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      newErrors.email = 'Email is invalid'
    }

    if (!form.password) {
      newErrors.password = 'Password is required'
    } else if (form.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()

    if (!validateForm()) return

    try {
      await login(form.email, form.password)
      toast.success('Welcome to ApexShare!')
      navigate('/', { replace: true })
    } catch (error: any) {
      toast.error(error.message || 'Login failed')
    }
  }

  const handleDemoLogin = async (account: typeof demoAccounts[0]) => {
    setForm({ ...form, email: account.email, password: account.password })

    try {
      await login(account.email, account.password)
      toast.success(`Welcome! Logged in as ${account.role}`)
      navigate('/', { replace: true })
    } catch (error: any) {
      toast.error(error.message || 'Demo login failed')
    }
  }

  const handleInputChange = (field: keyof LoginForm) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm(prev => ({ ...prev, [field]: value }))

    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Sign in to your account
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Access your secure training platform
        </p>
      </div>

      {/* Demo Access Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700 text-center">Quick Demo Access</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {demoAccounts.map((account) => (
            <motion.button
              key={account.role}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleDemoLogin(account)}
              disabled={isLoading}
              className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-left">
                <div className="flex items-center space-x-2">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium',
                    account.role === 'trainer' ? 'bg-primary-600' : 'bg-secondary-600'
                  )}>
                    {account.role === 'trainer' ? '👨‍🏫' : '👨‍🎓'}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 capitalize">{account.role}</p>
                    <p className="text-xs text-gray-500">Demo Account</p>
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">Or sign in with email</span>
        </div>
      </div>

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Email Field */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email address
          </label>
          <div className="mt-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={handleInputChange('email')}
              className={cn(
                'input pl-10',
                errors.email && 'input-error'
              )}
              placeholder="Enter your email"
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-sm text-error-600">{errors.email}</p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <div className="mt-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={form.password}
              onChange={handleInputChange('password')}
              className={cn(
                'input pl-10 pr-10',
                errors.password && 'input-error'
              )}
              placeholder="Enter your password"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-500" />
              ) : (
                <Eye className="h-5 w-5 text-gray-400 hover:text-gray-500" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-sm text-error-600">{errors.password}</p>
          )}
        </div>

        {/* Remember Me */}
        <div className="flex items-center justify-between">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={form.rememberMe}
              onChange={handleInputChange('rememberMe')}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-600">Remember me</span>
          </label>

          <button
            type="button"
            className="text-sm text-primary-600 hover:text-primary-500"
            onClick={() => toast('Password reset functionality coming soon')}
          >
            Forgot password?
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-3 bg-error-50 border border-error-200 rounded-lg"
          >
            <p className="text-sm text-error-700">{error}</p>
          </motion.div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full btn btn-primary btn-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <InlineSpinner className="mr-2" />
              Signing in...
            </>
          ) : (
            <>
              <LogIn className="mr-2 h-5 w-5" />
              Sign in
            </>
          )}
        </button>
      </form>

      {/* Additional Information */}
      <div className="text-center">
        <p className="text-xs text-gray-500">
          By signing in, you agree to our terms of service and privacy policy.
        </p>
      </div>
    </div>
  )
}