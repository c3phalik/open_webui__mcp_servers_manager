"use client"

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { UserPlus, Edit, Key, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { PasswordDisplay } from './password-display'

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

interface UserManagementModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit" | "resetPassword"
  user?: UserData
  onSuccess: (result?: { password?: string }) => void
}

export function UserManagementModal({
  open,
  onOpenChange,
  mode,
  user,
  onSuccess
}: UserManagementModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    isAdmin: false
  })
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Reset form when modal opens/closes or mode changes
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && user) {
        setFormData({
          name: user.name || '',
          email: user.email,
          isAdmin: user.role === 'admin'
        })
      } else {
        setFormData({
          name: '',
          email: '',
          isAdmin: false
        })
      }
      
      // Auto-generate password for create and reset modes
      if (mode === 'create' || mode === 'resetPassword') {
        generatePassword()
      } else {
        setGeneratedPassword('')
      }
      
      setErrors({})
    }
  }, [open, mode, user])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    // Skip validation for reset password mode since no form fields are required
    if (mode === 'resetPassword') {
      setErrors(newErrors)
      return true
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }
    
    if (mode === 'create' && !formData.name.trim()) {
      newErrors.name = 'Name is required for new users'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const generatePassword = () => {
    // Generate password on client side for immediate display
    // Server will also generate its own password for security
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*+-=?'
    let password = ''
    
    // Ensure at least one of each type
    const types = [
      'ABCDEFGHJKMNPQRSTUVWXYZ',
      'abcdefghjkmnpqrstuvwxyz', 
      '23456789',
      '!@#$%^&*+-=?'
    ]
    
    types.forEach(type => {
      password += type[Math.floor(Math.random() * type.length)]
    })
    
    // Fill remaining characters
    for (let i = 4; i < 16; i++) {
      password += chars[Math.floor(Math.random() * chars.length)]
    }
    
    // Shuffle password
    password = password.split('').sort(() => Math.random() - 0.5).join('')
    
    setGeneratedPassword(password)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    setIsLoading(true)
    
    try {
      let response: Response
      let endpoint = ''
      let method = ''
      let body: Record<string, unknown> = {}

      switch (mode) {
        case 'create':
          endpoint = '/api/admin/users'
          method = 'POST'
          body = {
            name: formData.name.trim(),
            email: formData.email.trim().toLowerCase(),
            role: formData.isAdmin ? 'admin' : 'user'
          }
          break
          
        case 'edit':
          endpoint = `/api/admin/users/${user?.id}`
          method = 'PUT'
          body = {
            name: formData.name.trim(),
            email: formData.email.trim().toLowerCase(),
            role: formData.isAdmin ? 'admin' : 'user'
          }
          break
          
        case 'resetPassword':
          // Require password generation before allowing reset
          if (!generatedPassword) {
            toast.error('Please generate a password first')
            return
          }
          endpoint = `/api/admin/users/${user?.id}/reset-password`
          method = 'POST'
          body = { newPassword: generatedPassword }
          break
      }

      response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to ${mode} user`)
      }

      const result = await response.json()
      
      // Handle success
      const successMessages = {
        create: 'User created successfully',
        edit: 'User updated successfully', 
        resetPassword: 'Password reset successfully'
      }
      
      toast.success(successMessages[mode])
      
      // Pass back the generated password for create operations, but not reset (modal already has it)
      if (mode === 'create' && result.password) {
        onSuccess({ password: result.password })
      } else if (mode === 'resetPassword') {
        // For reset password, use the password we generated in the modal
        onSuccess({ password: generatedPassword })
      } else {
        onSuccess()
      }
      onOpenChange(false)
      
    } catch (error) {
      console.error(`Error during ${mode}:`, error)
      toast.error(error instanceof Error ? error.message : `Failed to ${mode} user`)
    } finally {
      setIsLoading(false)
    }
  }

  const getModalTitle = () => {
    switch (mode) {
      case 'create': return 'Add New User'
      case 'edit': return 'Edit User'
      case 'resetPassword': return 'Reset Password'
      default: return 'Manage User'
    }
  }

  const getModalIcon = () => {
    switch (mode) {
      case 'create': return <UserPlus className="h-5 w-5" />
      case 'edit': return <Edit className="h-5 w-5" />
      case 'resetPassword': return <Key className="h-5 w-5" />
      default: return <UserPlus className="h-5 w-5" />
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getModalIcon()}
            {getModalTitle()}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode !== 'resetPassword' && (
            <>
              {/* Name Field */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  Name {mode === 'create' && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter full name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  disabled={isLoading}
                  className={errors.name ? 'border-red-500 focus:border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name}</p>
                )}
              </div>

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email address"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  disabled={isLoading}
                  className={errors.email ? 'border-red-500 focus:border-red-500' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email}</p>
                )}
              </div>

              {/* Admin Checkbox */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isAdmin"
                  checked={formData.isAdmin}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, isAdmin: Boolean(checked) }))
                  }
                  disabled={isLoading}
                />
                <Label htmlFor="isAdmin" className="text-sm font-medium leading-none">
                  Grant administrator privileges
                </Label>
              </div>
              
              {formData.isAdmin && (
                <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded-lg">
                  <p className="font-medium text-blue-800">Administrator privileges include:</p>
                  <ul className="mt-1 space-y-0.5 text-blue-700">
                    <li>• Access to MCPO monitoring and controls</li>
                    <li>• Ability to manage all users and their MCP servers</li>
                    <li>• System settings configuration</li>
                  </ul>
                </div>
              )}
            </>
          )}

          {/* Password Generation for Create/Reset */}
          {(mode === 'create' || mode === 'resetPassword') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  {mode === 'create' ? 'Generated Password' : 'New Password'}
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generatePassword}
                  disabled={isLoading}
                  className="gap-2"
                >
                  <RefreshCw className="h-3 w-3" />
                  Generate
                </Button>
              </div>
              
              <PasswordDisplay 
                password={generatedPassword}
                label=""
                className="space-y-0"
              />
              
              {!generatedPassword && (
                <p className="text-sm text-muted-foreground">
                  A secure password has been generated automatically. You can generate a new one if needed.
                </p>
              )}
            </div>
          )}

          {/* Reset Password Info */}
          {mode === 'resetPassword' && user && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm font-medium text-yellow-800">
                Reset password for {user.email}
                {user.name && ` (${user.name})`}?
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                A new secure password will be generated automatically. The user will need to sign in with the new password.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {mode === 'create' ? 'Creating...' : mode === 'edit' ? 'Updating...' : 'Resetting...'}
                </>
              ) : (
                <>
                  {getModalIcon()}
                  {mode === 'create' ? 'Create User' : mode === 'edit' ? 'Update User' : 'Reset Password'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}