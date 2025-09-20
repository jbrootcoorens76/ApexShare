/**
 * Upload Page Component
 *
 * Comprehensive file upload interface for trainers with session creation,
 * drag-and-drop upload, and progress tracking. Mobile-optimized with
 * robust error handling.
 */

import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Settings, Send, Save } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { useQuery, useMutation, useQueryClient } from 'react-query'

import { apiService } from '@/services/api'
import { FileUploadZone } from '@/components/upload/FileUploadZone'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { cn } from '@/utils/cn'
import type { CreateSessionForm, TrainingSession, UploadProgress } from '@/types'

interface UploadState {
  session: TrainingSession | null
  isNewSession: boolean
  sessionForm: CreateSessionForm
  uploads: UploadProgress[]
  showSettings: boolean
}

export const UploadPage: React.FC = () => {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [state, setState] = useState<UploadState>({
    session: null,
    isNewSession: !sessionId,
    sessionForm: {
      title: '',
      description: '',
      studentEmails: [],
      isPublic: false,
      metadata: {},
    },
    uploads: [],
    showSettings: false,
  })

  // Fetch existing session if sessionId is provided
  const { data: sessionData, isLoading: sessionLoading } = useQuery(
    ['session', sessionId],
    () => sessionId ? apiService.sessions.getById(sessionId) : null,
    {
      enabled: !!sessionId,
      onSuccess: (data) => {
        if (data?.success && data.data) {
          setState(prev => ({
            ...prev,
            session: data.data!,
            sessionForm: {
              title: data.data!.title,
              description: data.data!.description || '',
              studentEmails: data.data!.studentEmails,
              isPublic: data.data!.isPublic,
              metadata: data.data!.metadata || {},
            },
          }))
        }
      },
    }
  )

  // Create session mutation
  const createSessionMutation = useMutation(
    (sessionData: CreateSessionForm) => apiService.sessions.create(sessionData),
    {
      onSuccess: (data) => {
        if (data.success && data.data) {
          setState(prev => ({
            ...prev,
            session: data.data!,
            isNewSession: false,
          }))
          queryClient.invalidateQueries('trainer-sessions')
          toast.success('Session created successfully!')
          // Update URL without navigation
          window.history.replaceState(null, '', `/trainer/upload/${data.data!.id}`)
        }
      },
      onError: (error: any) => {
        toast.error(error.message || 'Failed to create session')
      },
    }
  )

  // Update session mutation
  const updateSessionMutation = useMutation(
    ({ sessionId, sessionData }: { sessionId: string; sessionData: Partial<CreateSessionForm> }) =>
      apiService.sessions.update(sessionId, sessionData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['session', sessionId])
        toast.success('Session updated successfully!')
      },
      onError: (error: any) => {
        toast.error(error.message || 'Failed to update session')
      },
    }
  )

  // Handle form changes
  const updateSessionForm = (updates: Partial<CreateSessionForm>) => {
    setState(prev => ({
      ...prev,
      sessionForm: { ...prev.sessionForm, ...updates },
    }))
  }

  // Handle session creation/update
  const handleSaveSession = async () => {
    if (!state.sessionForm.title.trim()) {
      toast.error('Session title is required')
      return
    }

    if (state.isNewSession) {
      createSessionMutation.mutate(state.sessionForm)
    } else if (state.session) {
      updateSessionMutation.mutate({
        sessionId: state.session.id,
        sessionData: state.sessionForm,
      })
    }
  }

  // Handle upload progress
  const handleUploadProgress = (progress: UploadProgress) => {
    setState(prev => ({
      ...prev,
      uploads: prev.uploads.map(upload =>
        upload.fileId === progress.fileId ? progress : upload
      ),
    }))
  }

  // Handle upload start
  const handleUploadStart = (file: File) => {
    const progress: UploadProgress = {
      fileId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fileName: file.name,
      progress: 0,
      speed: 0,
      eta: 0,
      status: 'pending',
      uploadedBytes: 0,
      totalBytes: file.size,
      startTime: Date.now(),
    }

    setState(prev => ({
      ...prev,
      uploads: [...prev.uploads, progress],
    }))
  }

  // Handle upload completion
  const handleUploadComplete = (fileId: string, fileInfo: any) => {
    setState(prev => ({
      ...prev,
      uploads: prev.uploads.filter(upload => upload.fileId !== fileId),
    }))

    // Refresh session data to show new file
    if (state.session) {
      queryClient.invalidateQueries(['session', state.session.id])
    }
  }

  // Handle upload error
  const handleUploadError = (error: string, file: File) => {
    setState(prev => ({
      ...prev,
      uploads: prev.uploads.filter(upload => upload.fileName !== file.name),
    }))
  }

  // Add student email
  const addStudentEmail = (email: string) => {
    if (email && !state.sessionForm.studentEmails.includes(email)) {
      updateSessionForm({
        studentEmails: [...state.sessionForm.studentEmails, email],
      })
    }
  }

  // Remove student email
  const removeStudentEmail = (email: string) => {
    updateSessionForm({
      studentEmails: state.sessionForm.studentEmails.filter(e => e !== email),
    })
  }

  if (sessionLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LoadingSpinner size="lg" message="Loading session..." />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <button
            onClick={() => navigate('/trainer')}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">
              {state.isNewSession ? 'Create Training Session' : 'Upload Files'}
            </h1>
            <p className="text-gray-600">
              {state.isNewSession
                ? 'Create a new session and upload training videos'
                : `Adding files to: ${state.session?.title}`
              }
            </p>
          </div>
          <button
            onClick={() => setState(prev => ({ ...prev, showSettings: !prev.showSettings }))}
            className="btn btn-secondary"
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Session Settings Panel */}
        <AnimatePresence>
          {(state.showSettings || state.isNewSession) && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="lg:col-span-1"
            >
              <div className="card sticky top-8">
                <div className="card-header">
                  <h2 className="text-lg font-semibold text-gray-900">Session Settings</h2>
                </div>
                <div className="card-body space-y-4">
                  {/* Session Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Session Title *
                    </label>
                    <input
                      type="text"
                      value={state.sessionForm.title}
                      onChange={(e) => updateSessionForm({ title: e.target.value })}
                      className="input"
                      placeholder="Enter session title"
                      required
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={state.sessionForm.description}
                      onChange={(e) => updateSessionForm({ description: e.target.value })}
                      className="input"
                      rows={3}
                      placeholder="Optional description"
                    />
                  </div>

                  {/* Student Emails */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Student Emails
                    </label>
                    <div className="space-y-2">
                      <div className="flex space-x-2">
                        <input
                          type="email"
                          className="input flex-1"
                          placeholder="student@example.com"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              const input = e.target as HTMLInputElement
                              addStudentEmail(input.value)
                              input.value = ''
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => {
                            const input = (e.target as HTMLButtonElement).previousElementSibling as HTMLInputElement
                            addStudentEmail(input.value)
                            input.value = ''
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>

                      {state.sessionForm.studentEmails.length > 0 && (
                        <div className="space-y-1">
                          {state.sessionForm.studentEmails.map((email) => (
                            <div
                              key={email}
                              className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg"
                            >
                              <span className="text-sm text-gray-700">{email}</span>
                              <button
                                type="button"
                                onClick={() => removeStudentEmail(email)}
                                className="text-gray-400 hover:text-error-600 transition-colors"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Public Access */}
                  <div>
                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={state.sessionForm.isPublic}
                        onChange={(e) => updateSessionForm({ isPublic: e.target.checked })}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700">Public Access</span>
                        <p className="text-xs text-gray-500">Allow access without email invitation</p>
                      </div>
                    </label>
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={handleSaveSession}
                    disabled={createSessionMutation.isLoading || updateSessionMutation.isLoading}
                    className={cn(
                      'w-full btn',
                      state.isNewSession ? 'btn-primary' : 'btn-secondary'
                    )}
                  >
                    {createSessionMutation.isLoading || updateSessionMutation.isLoading ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        {state.isNewSession ? 'Creating...' : 'Updating...'}
                      </>
                    ) : (
                      <>
                        {state.isNewSession ? <Plus className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        {state.isNewSession ? 'Create Session' : 'Save Changes'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload Area */}
        <div className={cn(
          'transition-all duration-300',
          (state.showSettings || state.isNewSession) ? 'lg:col-span-2' : 'lg:col-span-3'
        )}>
          {state.isNewSession && !state.session ? (
            <div className="card">
              <div className="card-body text-center py-12">
                <div className="text-gray-400 mb-4">
                  <Send className="h-16 w-16 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Create Session First
                </h3>
                <p className="text-gray-500 mb-6">
                  Please fill in the session details and create the session before uploading files.
                </p>
              </div>
            </div>
          ) : (
            <FileUploadZone
              sessionId={state.session?.id}
              onUploadStart={handleUploadStart}
              onUploadProgress={handleUploadProgress}
              onUploadComplete={handleUploadComplete}
              onUploadError={handleUploadError}
              className="mb-8"
            />
          )}
        </div>
      </div>
    </div>
  )
}