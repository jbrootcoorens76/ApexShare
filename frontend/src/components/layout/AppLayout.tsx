/**
 * Main Application Layout
 *
 * Provides the layout structure for authenticated users including
 * header navigation, sidebar, and main content area. Responsive
 * design adapts to mobile and desktop views.
 */

import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { cn } from '@/utils/cn'
import { getDeviceInfo } from '@/utils/device'

interface AppLayoutProps {
  children?: React.ReactNode
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const deviceInfo = getDeviceInfo()

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen)
  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && deviceInfo.isMobile && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        'fixed inset-y-0 left-0 z-30 w-64 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <Sidebar onClose={closeSidebar} />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header
          onMenuClick={toggleSidebar}
          showMenuButton={deviceInfo.isMobile}
        />

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="safe-top safe-bottom">
            {children || <Outlet />}
          </div>
        </main>
      </div>
    </div>
  )
}