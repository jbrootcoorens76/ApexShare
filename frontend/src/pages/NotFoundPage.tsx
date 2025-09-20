/**
 * 404 Not Found Page Component
 *
 * User-friendly 404 page with navigation options and helpful messaging.
 */

import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Home, ArrowLeft, Search } from 'lucide-react'
import { motion } from 'framer-motion'

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* 404 Illustration */}
          <div className="mb-8">
            <div className="text-9xl font-bold text-primary-600 mb-4">404</div>
            <div className="text-6xl mb-4">🏍️</div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Route Not Found
          </h1>

          <p className="text-lg text-gray-600 mb-8">
            Looks like you took a wrong turn. The page you're looking for doesn't exist
            or has been moved to a different location.
          </p>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate(-1)}
                className="btn btn-secondary flex items-center justify-center"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </button>

              <Link
                to="/"
                className="btn btn-primary flex items-center justify-center"
              >
                <Home className="mr-2 h-4 w-4" />
                Home Page
              </Link>
            </div>

            <div className="text-sm text-gray-500">
              <p>Need help? Contact support or try searching for what you need.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}