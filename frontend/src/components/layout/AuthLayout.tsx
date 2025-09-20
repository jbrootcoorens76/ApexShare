/**
 * Authentication Layout
 *
 * Layout for authentication pages (login, register, etc.)
 * Features a clean, centered design with branding.
 */

import React from 'react'
import { Outlet, Link } from 'react-router-dom'

interface AuthLayoutProps {
  children?: React.ReactNode
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo */}
        <Link to="/" className="flex justify-center">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">🏍️</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">ApexShare</span>
          </div>
        </Link>

        <h1 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
          Motorcycle Training Platform
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Secure video sharing for training sessions
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-lg sm:rounded-lg sm:px-10">
          {children || <Outlet />}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500">
          © 2025 ApexShare Training. Built with security and performance in mind.
        </p>
      </div>
    </div>
  )
}