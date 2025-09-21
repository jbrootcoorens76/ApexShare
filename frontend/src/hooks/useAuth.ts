/**
 * Authentication hook for ApexShare
 *
 * Provides authentication state management, login/logout functionality,
 * and user session persistence.
 */

import React from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiService, setAuthToken, removeAuthToken } from '@/services/api'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Actions
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  getCurrentUser: () => Promise<void>
  clearError: () => void
  setUser: (user: User | null) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })

        try {
          const response = await apiService.auth.login(email, password)

          if (response.success && response.data) {
            const { user, token } = response.data
            setAuthToken(token)
            set({
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            })
          } else {
            throw new Error(response.error || 'Login failed')
          }
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.message || 'Login failed',
            user: null,
            isAuthenticated: false,
          })
          throw error
        }
      },

      logout: async () => {
        set({ isLoading: true })

        try {
          await apiService.auth.logout()
        } catch (error) {
          // Log error but don't throw - we want to clear local state regardless
          console.error('Logout API call failed:', error)
        } finally {
          removeAuthToken()
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          })
        }
      },

      getCurrentUser: async () => {
        set({ isLoading: true, error: null })

        try {
          const response = await apiService.auth.getCurrentUser()

          if (response.success && response.data) {
            set({
              user: response.data,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            })
          } else {
            // Token might be invalid, clear auth state
            removeAuthToken()
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: null,
            })
          }
        } catch (error: any) {
          // Token might be invalid, clear auth state
          removeAuthToken()
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: error.message || 'Failed to get user information',
          })
        }
      },

      clearError: () => {
        set({ error: null })
      },

      setUser: (user: User | null) => {
        set({
          user,
          isAuthenticated: user !== null,
        })
      },
    }),
    {
      name: 'apexshare-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

/**
 * Hook for using authentication state and actions
 */
export const useAuth = () => {
  const state = useAuthStore()

  return {
    // State
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,

    // Computed state
    isTrainer: state.user?.role === 'trainer',
    isStudent: state.user?.role === 'student',

    // Actions
    login: state.login,
    logout: state.logout,
    getCurrentUser: state.getCurrentUser,
    clearError: state.clearError,
    setUser: state.setUser,
  }
}

/**
 * Hook for requiring authentication
 * Redirects to login if not authenticated
 */
export const useRequireAuth = (redirectTo: string = '/auth/login') => {
  const { isAuthenticated, isLoading, getCurrentUser } = useAuth()

  // Check auth state on mount
  React.useEffect(() => {
    const token = localStorage.getItem('apexshare_auth_token')
    if (token && !isAuthenticated && !isLoading) {
      getCurrentUser()
    }
  }, [isAuthenticated, isLoading, getCurrentUser])

  // Redirect if not authenticated
  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = redirectTo
    }
  }, [isAuthenticated, isLoading, redirectTo])

  return { isAuthenticated, isLoading }
}

/**
 * Hook for protecting routes based on user role
 */
export const useRequireRole = (requiredRole: User['role']) => {
  const { user, isAuthenticated, isLoading } = useAuth()

  const hasRequiredRole = isAuthenticated && user?.role === requiredRole
  const isAuthorized = isAuthenticated && hasRequiredRole

  return {
    isAuthorized,
    hasRequiredRole,
    isAuthenticated,
    isLoading,
    userRole: user?.role,
  }
}