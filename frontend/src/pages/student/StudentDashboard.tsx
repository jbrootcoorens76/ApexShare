/**
 * Student Dashboard Component
 *
 * Main dashboard for students showing available sessions, recent downloads,
 * and quick access to training materials. Mobile-optimized interface.
 */

import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, FileVideo, Clock, Search, Filter, Eye } from 'lucide-react'
import { motion } from 'framer-motion'
import { useQuery } from 'react-query'

import { apiService } from '@/services/api'
import { formatFileSize, formatRelativeTime, formatNumber } from '@/utils/format'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { cn } from '@/utils/cn'

export const StudentDashboard: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Fetch available sessions for student
  const { data: sessions, isLoading: sessionsLoading } = useQuery(
    ['student-sessions', searchTerm, statusFilter],
    () => apiService.sessions.getAll({
      search: searchTerm || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    {
      staleTime: 1000 * 60 * 5, // 5 minutes
    }
  )

  // Quick stats
  const totalSessions = sessions?.data?.length || 0
  const activeSessions = sessions?.data?.filter(s => s.status === 'active').length || 0
  const totalFiles = sessions?.data?.reduce((acc, s) => acc + s.fileCount, 0) || 0

  const stats = [
    {
      name: 'Available Sessions',
      value: totalSessions,
      icon: FileVideo,
      color: 'primary',
    },
    {
      name: 'Active Sessions',
      value: activeSessions,
      icon: Eye,
      color: 'success',
    },
    {
      name: 'Total Files',
      value: totalFiles,
      icon: Download,
      color: 'warning',
    },
  ]

  const statusOptions = [
    { value: 'all', label: 'All Sessions' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Training</h1>
        <p className="mt-2 text-gray-600">
          Access your training sessions and download course materials.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
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
                    {formatNumber(stat.value)}
                  </p>
                </div>
                <div className={cn(
                  'p-3 rounded-full',
                  stat.color === 'primary' && 'bg-primary-100',
                  stat.color === 'success' && 'bg-success-100',
                  stat.color === 'warning' && 'bg-warning-100'
                )}>
                  <stat.icon className={cn(
                    'h-6 w-6',
                    stat.color === 'primary' && 'text-primary-600',
                    stat.color === 'success' && 'text-success-600',
                    stat.color === 'warning' && 'text-warning-600'
                  )} />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Search and Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="card mb-8"
      >
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10"
                placeholder="Search training sessions..."
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Filter className="h-5 w-5 text-gray-400" />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input pl-10 pr-10 appearance-none"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Sessions List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="card"
      >
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Training Sessions</h2>
        </div>
        <div className="card-body">
          {sessionsLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner message="Loading sessions..." />
            </div>
          ) : sessions?.data && sessions.data.length > 0 ? (
            <div className="space-y-4">
              {sessions.data.map((session) => (
                <div
                  key={session.id}
                  className="border border-gray-200 rounded-lg p-6 hover:border-primary-300 hover:bg-primary-50 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900 truncate">
                          {session.title}
                        </h3>
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

                      {session.description && (
                        <p className="text-gray-600 mb-3 line-clamp-2">
                          {session.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center">
                          <FileVideo className="h-4 w-4 mr-1" />
                          {session.fileCount} {session.fileCount === 1 ? 'file' : 'files'}
                        </span>
                        <span className="flex items-center">
                          <Download className="h-4 w-4 mr-1" />
                          {formatFileSize(session.totalSize)}
                        </span>
                        <span className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          Updated {formatRelativeTime(session.updatedAt)}
                        </span>
                        <span className="text-gray-400">
                          by {session.trainerName}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 sm:mt-0 sm:ml-6 flex-shrink-0">
                      <Link
                        to={`/student/sessions/${session.id}`}
                        className="btn btn-primary"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Session
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileVideo className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No training sessions available
              </h3>
              <p className="text-gray-500 mb-6">
                {searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters.'
                  : 'Your trainer hasn\'t shared any sessions with you yet.'
                }
              </p>
              {(searchTerm || statusFilter !== 'all') && (
                <div className="space-x-4">
                  <button
                    onClick={() => setSearchTerm('')}
                    className="btn btn-secondary"
                  >
                    Clear Search
                  </button>
                  <button
                    onClick={() => setStatusFilter('all')}
                    className="btn btn-secondary"
                  >
                    Reset Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}