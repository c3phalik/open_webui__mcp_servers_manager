"use client"

import { useState, useEffect } from 'react'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { UserManagementModal } from '@/components/admin/user-management-modal'
import { DeleteConfirmationDialog } from '@/components/admin/delete-confirmation-dialog'
import { UsersDataTable } from '@/components/admin/users-data-table'

interface UserData {
  id: string
  email: string
  name?: string
  role: string
  emailVerified: boolean
  createdAt: string
  _count: {
    mcpServers: number
  }
}

interface UserResponse {
  users: UserData[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

interface SystemSettings {
  signupEnabled: boolean
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  })
  const [settings, setSettings] = useState<SystemSettings>({ signupEnabled: true })
  const [settingsLoading, setSettingsLoading] = useState(false)
  
  // Modal states
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [userModalMode, setUserModalMode] = useState<"create" | "edit" | "resetPassword">("create")
  const [selectedUser, setSelectedUser] = useState<UserData | undefined>()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null)
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [showPasswordFor, setShowPasswordFor] = useState<string | null>(null)

  const fetchUsers = async (page = 1, search = '') => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search })
      })
      
      const response = await fetch(`/api/admin/users?${params}`)
      if (response.ok) {
        const data: UserResponse = await response.json()
        setUsers(data.users)
        setPagination(data.pagination)
      } else {
        toast.error('Failed to fetch users')
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Error loading users')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings')
      if (response.ok) {
        const data = await response.json()
        setSettings(data.settings)
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  }

  useEffect(() => {
    fetchUsers(1, searchQuery)
    fetchSettings()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchQuery !== '') {
        setCurrentPage(1)
        fetchUsers(1, searchQuery)
      } else {
        fetchUsers(currentPage, '')
      }
    }, 300)

    return () => clearTimeout(debounceTimer)
  }, [searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  // Modal handlers
  const openCreateModal = () => {
    setUserModalMode('create')
    setSelectedUser(undefined)
    setUserModalOpen(true)
  }

  const openEditModal = (user: UserData) => {
    setUserModalMode('edit')
    setSelectedUser(user)
    setUserModalOpen(true)
  }

  const openResetPasswordModal = (user: UserData) => {
    setUserModalMode('resetPassword')
    setSelectedUser(user)
    setUserModalOpen(true)
  }

  const openDeleteDialog = (user: UserData) => {
    setUserToDelete(user)
    setDeleteDialogOpen(true)
  }

  const handleModalSuccess = (result?: { password?: string }) => {
    fetchUsers(currentPage, searchQuery)
    
    if (result?.password) {
      setGeneratedPassword(result.password)
      setShowPasswordFor(selectedUser?.id || null)
      
      // Auto-hide password display after 5 minutes for security
      setTimeout(() => {
        setShowPasswordFor(null)
        setGeneratedPassword('')
      }, 300000)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete user')
      }

      const result = await response.json()
      toast.success(`User deleted successfully${result.deletedServers ? ` (${result.deletedServers} servers also deleted)` : ''}`)
      fetchUsers(currentPage, searchQuery)
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error(error instanceof Error ? error.message : 'Error deleting user')
      throw error // Re-throw to let the dialog handle it
    }
  }


  const updateSignupSetting = async (signupEnabled: boolean) => {
    try {
      setSettingsLoading(true)
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signupEnabled })
      })

      if (response.ok) {
        const data = await response.json()
        setSettings(data.settings)
        toast.success(signupEnabled ? 'Signup enabled' : 'Signup disabled')
      } else {
        toast.error('Failed to update signup setting')
      }
    } catch (error) {
      console.error('Error updating signup setting:', error)
      toast.error('Error updating signup setting')
    } finally {
      setSettingsLoading(false)
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    fetchUsers(page, searchQuery)
  }

  return (
    <ProtectedRoute requireAdmin={true}>
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-background via-background to-muted/20">
        <div className="container mx-auto max-w-7xl px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="mb-6">
              <h1 className="text-4xl font-bold tracking-tight">
                User Management
              </h1>
              <p className="text-muted-foreground">
                Manage user roles and system settings
              </p>
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between gap-4">
              {/* Settings Toggle */}
              <div className="flex items-center gap-3">
                <Label htmlFor="signup-enabled" className="text-sm font-medium whitespace-nowrap">
                  Enable Registration
                </Label>
                <Switch
                  id="signup-enabled"
                  checked={settings.signupEnabled}
                  onCheckedChange={updateSignupSetting}
                  disabled={settingsLoading}
                />
              </div>
              
              {/* Add User Button */}
              <Button 
                onClick={openCreateModal}
                className="gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Add User
              </Button>
            </div>
          </div>

          {/* Users Data Table */}
          
              <UsersDataTable
                data={users}
                pagination={pagination}
                onPageChange={handlePageChange}
                onSearch={setSearchQuery}
                searchQuery={searchQuery}
                isLoading={isLoading}
                onEditUser={openEditModal}
                onResetPassword={openResetPasswordModal}
                onDeleteUser={openDeleteDialog}
                showPasswordFor={showPasswordFor}
                generatedPassword={generatedPassword}
              />
          
          {/* Modals */}
          <UserManagementModal
            open={userModalOpen}
            onOpenChange={setUserModalOpen}
            mode={userModalMode}
            user={selectedUser}
            onSuccess={handleModalSuccess}
          />

          <DeleteConfirmationDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            user={userToDelete}
            onConfirm={handleDeleteUser}
          />
        </div>
      </div>
    </ProtectedRoute>
  )
}