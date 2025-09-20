/**
 * Application Header Component
 *
 * Top navigation bar with user menu, notifications, and mobile menu toggle.
 * Responsive design with touch-friendly controls for mobile devices.
 */

import React, { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, Bell, User, LogOut, Settings, ChevronDown } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { getInitials } from '@/utils/format'
import { cn } from '@/utils/cn'

interface HeaderProps {
  onMenuClick: () => void
  showMenuButton: boolean
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, showMenuButton }) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/auth/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 safe-top">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left section */}
          <div className="flex items-center space-x-4">
            {/* Mobile menu button */}
            {showMenuButton && (
              <button
                type="button"
                className="touch-target p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 lg:hidden"
                onClick={onMenuClick}
                aria-label="Open sidebar"
              >
                <Menu className="h-6 w-6" />
              </button>
            )}

            {/* Logo for mobile when sidebar is hidden */}
            {showMenuButton && (
              <Link to="/" className="flex items-center space-x-2 lg:hidden">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">🏍️</span>
                </div>
                <span className="text-xl font-bold text-gray-900">ApexShare</span>
              </Link>
            )}
          </div>

          {/* Right section */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <button
              type="button"
              className="touch-target p-2 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="View notifications"
            >
              <Bell className="h-6 w-6" />
            </button>

            {/* User menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                className="touch-target flex items-center space-x-3 p-2 rounded-lg text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
              >
                {/* User avatar */}
                <div className="flex items-center space-x-2">
                  {user?.avatar ? (
                    <img
                      className="h-8 w-8 rounded-full object-cover"
                      src={user.avatar}
                      alt={user.name}
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
                      <span className="text-sm font-medium text-white">
                        {getInitials(user?.name || 'User')}
                      </span>
                    </div>
                  )}
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-gray-900 truncate max-w-32">
                      {user?.name || 'User'}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {user?.role || 'User'}
                    </p>
                  </div>
                  <ChevronDown className={cn(
                    'h-4 w-4 text-gray-400 transition-transform duration-200',
                    userMenuOpen && 'rotate-180'
                  )} />
                </div>
              </button>

              {/* User menu dropdown */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                  <div className="py-1">
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                      <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                    </div>

                    {/* Menu items */}
                    <div className="py-1">
                      <button
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        onClick={() => {
                          setUserMenuOpen(false)
                          // Navigate to profile
                        }}
                      >
                        <User className="h-4 w-4 mr-3" />
                        Profile
                      </button>

                      <button
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        onClick={() => {
                          setUserMenuOpen(false)
                          // Navigate to settings
                        }}
                      >
                        <Settings className="h-4 w-4 mr-3" />
                        Settings
                      </button>
                    </div>

                    {/* Logout */}
                    <div className="py-1 border-t border-gray-100">
                      <button
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        onClick={() => {
                          setUserMenuOpen(false)
                          handleLogout()
                        }}
                      >
                        <LogOut className="h-4 w-4 mr-3" />
                        Sign out
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}