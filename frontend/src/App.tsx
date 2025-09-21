/**
 * Main App component for ApexShare
 *
 * Handles routing, authentication, and global app state management.
 * Provides a responsive layout that adapts to different screen sizes.
 */

import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getDeviceInfo } from '@/utils/device'

// Layout components
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthLayout } from '@/components/layout/AuthLayout'

// Pages
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { TrainerDashboard } from '@/pages/trainer/TrainerDashboard'
import { StudentDashboard } from '@/pages/student/StudentDashboard'
import { UploadPage } from '@/pages/trainer/UploadPage'
import { DirectUploadPage } from '@/pages/DirectUploadPage'
import { SessionPage } from '@/pages/shared/SessionPage'
import { DownloadPage } from '@/pages/student/DownloadPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

// Components
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

function App() {
  const { isAuthenticated, isLoading, getCurrentUser, user } = useAuth()

  // Initialize auth state and device detection
  useEffect(() => {
    // Get device info and store for later use
    const deviceInfo = getDeviceInfo()
    console.log('Device Info:', deviceInfo)

    // Check for existing auth token and validate
    const token = localStorage.getItem('apexshare_auth_token')
    if (token && !isAuthenticated && !isLoading) {
      getCurrentUser()
    }
  }, [isAuthenticated, isLoading, getCurrentUser])

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" message="Loading ApexShare..." />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          {/* Public routes */}
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <Navigate to={user?.role === 'trainer' ? '/trainer' : '/student'} replace />
              ) : (
                <HomePage />
              )
            }
          />

          {/* Authentication routes */}
          <Route
            path="/auth/*"
            element={
              isAuthenticated ? (
                <Navigate to={user?.role === 'trainer' ? '/trainer' : '/student'} replace />
              ) : (
                <AuthLayout>
                  <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="*" element={<Navigate to="/auth/login" replace />} />
                  </Routes>
                </AuthLayout>
              )
            }
          />

          {/* Public upload route */}
          <Route path="/upload" element={<DirectUploadPage />} />

          {/* Session access route (public but may require access code) */}
          <Route path="/session/:sessionId" element={<SessionPage />} />

          {/* Protected routes */}
          <Route
            path="/*"
            element={
              isAuthenticated ? (
                <AppLayout>
                  <Routes>
                    {/* Trainer routes */}
                    {user?.role === 'trainer' && (
                      <>
                        <Route path="/trainer" element={<TrainerDashboard />} />
                        <Route path="/trainer/upload" element={<UploadPage />} />
                        <Route path="/trainer/upload/:sessionId" element={<UploadPage />} />
                        <Route path="/trainer/sessions/:sessionId" element={<SessionPage />} />
                      </>
                    )}

                    {/* Student routes */}
                    {user?.role === 'student' && (
                      <>
                        <Route path="/student" element={<StudentDashboard />} />
                        <Route path="/student/download/:sessionId" element={<DownloadPage />} />
                        <Route path="/student/sessions/:sessionId" element={<SessionPage />} />
                      </>
                    )}

                    {/* Shared routes */}
                    <Route path="/sessions/:sessionId" element={<SessionPage />} />

                    {/* Role-based redirects */}
                    <Route
                      path="/trainer/*"
                      element={
                        user?.role === 'trainer' ? (
                          <Navigate to="/trainer" replace />
                        ) : (
                          <Navigate to="/student" replace />
                        )
                      }
                    />
                    <Route
                      path="/student/*"
                      element={
                        user?.role === 'student' ? (
                          <Navigate to="/student" replace />
                        ) : (
                          <Navigate to="/trainer" replace />
                        )
                      }
                    />

                    {/* Default redirect based on role */}
                    <Route
                      path="*"
                      element={
                        <Navigate to={user?.role === 'trainer' ? '/trainer' : '/student'} replace />
                      }
                    />
                  </Routes>
                </AppLayout>
              ) : (
                <Navigate to="/auth/login" replace />
              )
            }
          />

          {/* 404 route */}
          <Route path="/404" element={<NotFoundPage />} />
        </Routes>
      </div>
    </ErrorBoundary>
  )
}

export default App