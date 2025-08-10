"use client"

import { useState, useEffect } from 'react'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { 
  Users, 
  Search, 
  Shield, 
  User, 
  Calendar,
  Server,
  Settings,
  ChevronLeft,
  ChevronRight,
  Loader2,
  UserPlus,
  Edit,
  Key,
  Trash2,
  MoreVertical
} from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserManagementModal } from '@/components/admin/user-management-modal'
import { DeleteConfirmationDialog } from '@/components/admin/delete-confirmation-dialog'
import { PasswordDisplay } from '@/components/admin/password-display'

interface UserData {
  id: string
  email: string
  name?: string
  isAdmin: boolean
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
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    User Management
                  </h1>
                  <p className="text-muted-foreground">
                    Manage user roles and system settings
                  </p>
                </div>
              </div>
              
              <Button 
                onClick={openCreateModal}
                className="gap-2"
                size="lg"
              >
                <UserPlus className="h-4 w-4" />
                Add User
              </Button>
            </div>
          </div>

          {/* System Settings */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                System Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="signup-enabled" className="text-base font-medium">
                    Enable User Registration
                  </Label>
                  <div className="text-sm text-muted-foreground">
                    Allow new users to create accounts
                  </div>
                </div>
                <Switch
                  id="signup-enabled"
                  checked={settings.signupEnabled}
                  onCheckedChange={updateSignupSetting}
                  disabled={settingsLoading}
                />
              </div>
            </CardContent>
          </Card>

          {/* Search */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search users by email or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>Users ({pagination.total})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  Loading users...
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? 'No users found matching your search' : 'No users found'}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {users.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{user.email}</span>
                                {user.isAdmin && (
                                  <Badge variant="default" className="gap-1">
                                    <Shield className="h-3 w-3" />
                                    Admin
                                  </Badge>
                                )}
                                {!user.emailVerified && (
                                  <Badge variant="outline">Unverified</Badge>
                                )}
                              </div>
                              {user.name && (
                                <p className="text-sm text-muted-foreground">{user.name}</p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Server className="h-3 w-3" />
                              {user._count.mcpServers} servers
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(user.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          
                          {/* Password display for newly created/reset users */}
                          {showPasswordFor === user.id && generatedPassword && (
                            <div className="max-w-xs">
                              <PasswordDisplay 
                                password={generatedPassword}
                                label="New Password"
                                className="text-xs"
                              />
                            </div>
                          )}
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => openEditModal(user)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit User
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openResetPasswordModal(user)}>
                                <Key className="h-4 w-4 mr-2" />
                                Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => openDeleteDialog(user)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {pagination.pages > 1 && (
                    <div className="flex items-center justify-between mt-6">
                      <div className="text-sm text-muted-foreground">
                        Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(pagination.page - 1)}
                          disabled={pagination.page <= 1}
                          className="gap-1"
                        >
                          <ChevronLeft className="h-3 w-3" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(pagination.page + 1)}
                          disabled={pagination.page >= pagination.pages}
                          className="gap-1"
                        >
                          Next
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

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