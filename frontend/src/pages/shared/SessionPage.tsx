/**
 * Session Page Component
 *
 * Shared page for viewing session details, accessible by both trainers and students.
 * Adapts interface based on user role and session access permissions.
 */

import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  FileVideo,
  Download,
  Upload,
  Users,
  Clock,
  Lock,
  Eye,
  Share2,
  Settings,
  Trash2,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { useQuery, useMutation, useQueryClient } from 'react-query'

import { apiService } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import { formatFileSize, formatRelativeTime, formatDateTime } from '@/utils/format'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { cn } from '@/utils/cn'

export const SessionPage: React.FC = () => {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Fetch session data
  const { data: sessionData, isLoading: sessionLoading } = useQuery(
    ['session', sessionId],
    () => sessionId ? apiService.sessions.getById(sessionId) : null,
    {
      enabled: !!sessionId,
    }
  )

  // Fetch session files
  const { data: filesData, isLoading: filesLoading } = useQuery(
    ['session-files', sessionId],
    () => sessionId ? apiService.files.getSessionFiles(sessionId) : null,
    {
      enabled: !!sessionId,
    }
  )

  // Delete session mutation (trainer only)
  const deleteSessionMutation = useMutation(
    () => sessionId ? apiService.sessions.delete(sessionId) : Promise.reject('No session ID'),
    {
      onSuccess: () => {
        toast.success('Session deleted successfully')
        queryClient.invalidateQueries('trainer-sessions')
        navigate('/trainer')
      },
      onError: (error: any) => {
        toast.error(error.message || 'Failed to delete session')
      },
    }
  )

  const session = sessionData?.data
  const files = filesData?.data || []
  const isTrainer = user?.role === 'trainer'
  const isOwner = isTrainer && session?.trainerId === user?.id

  // Handle session deletion
  const handleDeleteSession = () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true)
      return
    }
    deleteSessionMutation.mutate()
  }

  // Copy session link
  const handleShareSession = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Session link copied to clipboard')
    }).catch(() => {
      toast.error('Failed to copy link')
    })
  }

  if (sessionLoading || filesLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LoadingSpinner size="lg" message="Loading session..." />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <Lock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Session Not Found
          </h2>
          <p className="text-gray-600 mb-6">
            The session you're looking for doesn't exist or you don't have access to it.
          </p>
          <button
            onClick={() => navigate(isAuthenticated ? (isTrainer ? '/trainer' : '/student') : '/')}
            className="btn btn-primary"
          >
            {isAuthenticated ? 'Back to Dashboard' : 'Go Home'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(isTrainer ? '/trainer' : '/student')}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{session.title}</h1>
              <p className="text-gray-600 mt-1">
                {session.description || 'Training session'}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleShareSession}
              className="btn btn-secondary"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </button>

            {isOwner && (
              <>
                <button
                  onClick={() => navigate(`/trainer/upload/${session.id}`)}
                  className="btn btn-primary"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Add Files
                </button>

                <div className="relative">
                  <button
                    onClick={handleDeleteSession}
                    className={cn(
                      'btn',
                      showDeleteConfirm ? 'btn-error' : 'btn-secondary'
                    )}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {showDeleteConfirm ? 'Confirm Delete' : 'Delete'}
                  </button>
                  {showDeleteConfirm && (
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-gray-500 text-white rounded-full text-xs hover:bg-gray-600"
                    >
                      ×
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Session metadata */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="card-body text-center">
              <FileVideo className="h-8 w-8 text-primary-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{files.length}</p>
              <p className="text-sm text-gray-600">Files</p>
            </div>
          </div>

          <div className="card">
            <div className="card-body text-center">
              <Download className="h-8 w-8 text-success-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">
                {formatFileSize(session.totalSize)}
              </p>
              <p className="text-sm text-gray-600">Total Size</p>
            </div>
          </div>

          <div className="card">
            <div className="card-body text-center">
              <Users className="h-8 w-8 text-warning-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">
                {session.studentEmails.length}
              </p>
              <p className="text-sm text-gray-600">Students</p>
            </div>
          </div>

          <div className="card">
            <div className="card-body text-center">
              <Clock className="h-8 w-8 text-secondary-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">
                {formatRelativeTime(session.updatedAt)}
              </p>
              <p className="text-sm text-gray-600">Last Updated</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Session Info */}
        <div className="lg:col-span-1">
          <div className="card sticky top-8">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-gray-900">Session Details</h2>
            </div>
            <div className="card-body space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trainer
                </label>
                <p className="text-gray-900">{session.trainerName}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Created
                </label>
                <p className="text-gray-900">{formatDateTime(session.createdAt)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Access
                </label>
                <p className="text-gray-900">
                  {session.isPublic ? 'Public' : 'Private'}
                </p>
              </div>

              {session.expiresAt && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expires
                  </label>
                  <p className="text-gray-900">{formatDateTime(session.expiresAt)}</p>
                </div>
              )}

              {session.studentEmails.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Students ({session.studentEmails.length})
                  </label>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {session.studentEmails.map((email) => (
                      <p key={email} className="text-sm text-gray-600 truncate">
                        {email}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {session.metadata && Object.keys(session.metadata).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Info
                  </label>
                  <div className="space-y-1">
                    {session.metadata.location && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Location:</span> {session.metadata.location}
                      </p>
                    )}
                    {session.metadata.date && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Date:</span> {session.metadata.date}
                      </p>
                    )}
                    {session.metadata.notes && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Notes:</span> {session.metadata.notes}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Files List */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Session Files ({files.length})
              </h2>
              {isOwner && (
                <button
                  onClick={() => navigate(`/trainer/upload/${session.id}`)}
                  className="btn btn-primary btn-sm"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Add Files
                </button>
              )}
            </div>
            <div className="card-body">
              {files.length > 0 ? (
                <div className="space-y-4">
                  {files.map((file) => (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 hover:bg-primary-50 transition-all"
                    >
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                            <FileVideo className="h-8 w-8 text-primary-600" />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">
                            {file.originalName}
                          </h3>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mt-1">
                            <span>{formatFileSize(file.fileSize)}</span>
                            <span>Uploaded {formatRelativeTime(file.uploadedAt)}</span>
                            {file.downloadCount > 0 && (
                              <span>{file.downloadCount} downloads</span>
                            )}
                          </div>

                          {file.metadata && (
                            <div className="flex flex-wrap gap-4 text-xs text-gray-400 mt-2">
                              {file.metadata.duration && (
                                <span>Duration: {Math.round(file.metadata.duration)}s</span>
                              )}
                              {file.metadata.resolution && (
                                <span>Resolution: {file.metadata.resolution}</span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex-shrink-0 flex items-center space-x-2">
                          {file.mimeType.startsWith('video/') && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => toast.info('Video preview coming soon')}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          )}

                          <button
                            onClick={() => navigate(isTrainer ? `/trainer/sessions/${session.id}` : `/student/download/${session.id}`)}
                            className="btn btn-primary btn-sm"
                          >
                            <Download className="h-4 w-4 mr-1" />
                            {isTrainer ? 'Manage' : 'Download'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileVideo className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No files available
                  </h3>
                  <p className="text-gray-500 mb-6">
                    {isOwner
                      ? 'Upload training files to share with your students.'
                      : 'No training materials have been uploaded yet.'
                    }
                  </p>
                  {isOwner && (
                    <button
                      onClick={() => navigate(`/trainer/upload/${session.id}`)}
                      className="btn btn-primary"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Files
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}