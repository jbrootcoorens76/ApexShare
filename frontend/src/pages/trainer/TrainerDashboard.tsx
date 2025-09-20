/**
 * Trainer Dashboard Component
 *
 * Main dashboard for trainers showing session overview, recent uploads,
 * and quick actions. Features responsive cards and statistics.
 */

import React from 'react'
import { Link } from 'react-router-dom'
import { Plus, Upload, Users, BarChart3, Clock, FileVideo, Download } from 'lucide-react'
import { motion } from 'framer-motion'
import { useQuery } from 'react-query'

import { apiService } from '@/services/api'
import { formatFileSize, formatRelativeTime, formatNumber } from '@/utils/format'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { cn } from '@/utils/cn'

export const TrainerDashboard: React.FC = () => {
  // Fetch dashboard data
  const { data: sessions, isLoading: sessionsLoading } = useQuery(
    'trainer-sessions',
    () => apiService.sessions.getAll({ limit: 5 }),
    {
      staleTime: 1000 * 60 * 5, // 5 minutes
    }
  )

  const { data: metrics, isLoading: metricsLoading } = useQuery(
    'usage-metrics',
    () => apiService.analytics.getUsageMetrics('30d'),
    {
      staleTime: 1000 * 60 * 10, // 10 minutes
    }
  )

  // Quick stats data
  const stats = [
    {
      name: 'Total Sessions',
      value: metrics?.data?.totalSessions || 0,
      icon: FileVideo,
      color: 'primary',
      change: '+12%',
    },
    {
      name: 'Active Students',
      value: metrics?.data?.activeUsers || 0,
      icon: Users,
      color: 'success',
      change: '+5%',
    },
    {
      name: 'Total Downloads',
      value: metrics?.data?.totalDownloads || 0,
      icon: Download,
      color: 'warning',
      change: '+18%',
    },
    {
      name: 'Storage Used',
      value: formatFileSize(metrics?.data?.totalStorageUsed || 0),
      icon: BarChart3,
      color: 'secondary',
      change: '+8%',
    },
  ]

  // Quick actions
  const quickActions = [
    {
      name: 'Upload Files',
      description: 'Add new training videos',
      href: '/trainer/upload',
      icon: Upload,
      color: 'primary',
    },
    {
      name: 'Create Session',
      description: 'Start a new training session',
      href: '/trainer/sessions/new',
      icon: Plus,
      color: 'success',
    },
    {
      name: 'View Analytics',
      description: 'Track engagement and usage',
      href: '/trainer/analytics',
      icon: BarChart3,
      color: 'warning',
    },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Welcome back! Here's an overview of your training sessions and activity.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: index * 0.1 }}
            className="card"
          >
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {typeof stat.value === 'number' ? formatNumber(stat.value) : stat.value}
                  </p>
                  <p className={cn(
                    'text-sm font-medium',
                    stat.change.startsWith('+') ? 'text-success-600' : 'text-error-600'
                  )}>
                    {stat.change} from last month
                  </p>
                </div>
                <div className={cn(
                  'p-3 rounded-full',
                  stat.color === 'primary' && 'bg-primary-100',
                  stat.color === 'success' && 'bg-success-100',
                  stat.color === 'warning' && 'bg-warning-100',
                  stat.color === 'secondary' && 'bg-secondary-100'
                )}>
                  <stat.icon className={cn(
                    'h-6 w-6',
                    stat.color === 'primary' && 'text-primary-600',
                    stat.color === 'success' && 'text-success-600',
                    stat.color === 'warning' && 'text-warning-600',
                    stat.color === 'secondary' && 'text-secondary-600'
                  )} />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="lg:col-span-1"
        >
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
            </div>
            <div className="card-body space-y-4">
              {quickActions.map((action) => (
                <Link
                  key={action.name}
                  to={action.href}
                  className="block p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-all group"
                >
                  <div className="flex items-center space-x-3">
                    <div className={cn(
                      'p-2 rounded-lg group-hover:scale-110 transition-transform',
                      action.color === 'primary' && 'bg-primary-100 text-primary-600',
                      action.color === 'success' && 'bg-success-100 text-success-600',
                      action.color === 'warning' && 'bg-warning-100 text-warning-600'
                    )}>
                      <action.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 group-hover:text-primary-900">
                        {action.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {action.description}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Recent Sessions */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="lg:col-span-2"
        >
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Sessions</h2>
              <Link
                to="/trainer/sessions"
                className="text-sm text-primary-600 hover:text-primary-500 font-medium"
              >
                View all
              </Link>
            </div>
            <div className="card-body">
              {sessionsLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner message="Loading sessions..." />
                </div>
              ) : sessions?.data && sessions.data.length > 0 ? (
                <div className="space-y-4">
                  {sessions.data.slice(0, 5).map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-4 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          <div className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium',
                            session.status === 'active' && 'bg-success-600',
                            session.status === 'draft' && 'bg-warning-600',
                            session.status === 'completed' && 'bg-primary-600',
                            session.status === 'archived' && 'bg-gray-600'
                          )}>
                            <FileVideo className="h-5 w-5" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link
                            to={`/trainer/sessions/${session.id}`}
                            className="font-medium text-gray-900 hover:text-primary-600 truncate block"
                          >
                            {session.title}
                          </Link>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span className="flex items-center">
                              <Users className="h-3 w-3 mr-1" />
                              {session.studentEmails.length} students
                            </span>
                            <span className="flex items-center">
                              <FileVideo className="h-3 w-3 mr-1" />
                              {session.fileCount} files
                            </span>
                            <span className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatRelativeTime(session.updatedAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <span className={cn(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                          session.status === 'active' && 'bg-success-100 text-success-800',
                          session.status === 'draft' && 'bg-warning-100 text-warning-800',
                          session.status === 'completed' && 'bg-primary-100 text-primary-800',
                          session.status === 'archived' && 'bg-gray-100 text-gray-800'
                        )}>
                          {session.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileVideo className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No sessions yet</h3>
                  <p className="text-gray-500 mb-4">
                    Create your first training session to get started.
                  </p>
                  <Link
                    to="/trainer/upload"
                    className="btn btn-primary"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Session
                  </Link>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}