/**
 * Application Sidebar Component
 *
 * Navigation sidebar with role-based menu items and responsive design.
 * Includes proper focus management and accessibility features.
 */

import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Home,
  Upload,
  Download,
  FolderOpen,
  Users,
  BarChart3,
  Settings,
  X,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/utils/cn'

interface SidebarProps {
  onClose: () => void
}

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  roles?: Array<'trainer' | 'student'>
  badge?: string
}

const navigation: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/trainer',
    icon: Home,
    roles: ['trainer'],
  },
  {
    name: 'Dashboard',
    href: '/student',
    icon: Home,
    roles: ['student'],
  },
  {
    name: 'Upload Files',
    href: '/trainer/upload',
    icon: Upload,
    roles: ['trainer'],
  },
  {
    name: 'My Sessions',
    href: '/trainer/sessions',
    icon: FolderOpen,
    roles: ['trainer'],
  },
  {
    name: 'Available Downloads',
    href: '/student/downloads',
    icon: Download,
    roles: ['student'],
  },
  {
    name: 'My Downloads',
    href: '/student/sessions',
    icon: FolderOpen,
    roles: ['student'],
  },
  {
    name: 'Students',
    href: '/trainer/students',
    icon: Users,
    roles: ['trainer'],
  },
  {
    name: 'Analytics',
    href: '/trainer/analytics',
    icon: BarChart3,
    roles: ['trainer'],
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
]

export const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const { user } = useAuth()
  const location = useLocation()

  // Filter navigation items based on user role
  const filteredNavigation = navigation.filter(item => {
    if (!item.roles) return true
    return item.roles.includes(user?.role || 'student')
  })

  const isActive = (href: string) => {
    if (href === '/trainer' || href === '/student') {
      return location.pathname === href
    }
    return location.pathname.startsWith(href)
  }

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
        <Link to="/" className="flex items-center space-x-2" onClick={onClose}>
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">🏍️</span>
          </div>
          <span className="text-xl font-bold text-gray-900">ApexShare</span>
        </Link>

        {/* Close button for mobile */}
        <button
          type="button"
          className="touch-target p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 lg:hidden"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* User info */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
            <span className="text-white font-medium text-sm">
              {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.name || 'User'}
            </p>
            <p className="text-xs text-gray-500 capitalize">
              {user?.role || 'User'} Account
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {filteredNavigation.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            onClick={onClose}
            className={cn(
              'group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors touch-target',
              isActive(item.href)
                ? 'bg-primary-100 text-primary-700 border-r-2 border-primary-600'
                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <item.icon
              className={cn(
                'mr-3 flex-shrink-0 h-5 w-5',
                isActive(item.href) ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500'
              )}
            />
            <span className="flex-1">{item.name}</span>
            {item.badge && (
              <span className="ml-3 inline-block px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-800 rounded-full">
                {item.badge}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-500">
          <p className="font-medium">ApexShare v1.0.0</p>
          <p>Secure motorcycle training platform</p>
        </div>
      </div>
    </div>
  )
}