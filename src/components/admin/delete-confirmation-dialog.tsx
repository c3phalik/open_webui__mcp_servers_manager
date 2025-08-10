"use client"

import { useState } from 'react'
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
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react'

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

interface DeleteConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserData | null
  onConfirm: (userId: string) => Promise<void>
  isLoading?: boolean
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  user,
  onConfirm,
  isLoading = false
}: DeleteConfirmationDialogProps) {
  const [confirmationInput, setConfirmationInput] = useState('')

  const handleClose = () => {
    setConfirmationInput('')
    onOpenChange(false)
  }

  const handleConfirm = async () => {
    if (!user || confirmationInput !== user.email) return
    
    try {
      await onConfirm(user.id)
      handleClose()
    } catch (error) {
      // Error handling is done in the parent component
      console.error('Delete confirmation error:', error)
    }
  }

  const isConfirmationValid = user && confirmationInput === user.email
  const hasServers = user && user._count.mcpServers > 0

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Delete User Account
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Warning Message */}
          <div className="p-4 rounded-lg bg-red-50 border border-red-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-800">
                  This action cannot be undone
                </p>
                <p className="text-sm text-red-700">
                  You are about to permanently delete the user account for{' '}
                  <span className="font-medium">{user.email}</span>
                  {user.name && (
                    <span> ({user.name})</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Server Warning */}
          {hasServers && (
            <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-orange-800">
                    User owns {user._count.mcpServers} MCP server{user._count.mcpServers !== 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-orange-700">
                    All associated MCP servers will be permanently deleted along with this user account.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Confirmation Input */}
          <div className="space-y-2">
            <Label htmlFor="confirmation" className="text-sm font-medium">
              To confirm deletion, type the user&apos;s email address:
            </Label>
            <Input
              id="confirmation"
              type="email"
              placeholder={user.email}
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              disabled={isLoading}
              className="border-red-300 focus:border-red-500 focus:ring-red-500"
            />
          </div>

          {/* Additional Warnings */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• The user will be immediately signed out from all sessions</p>
            <p>• All user data and preferences will be lost</p>
            {hasServers && <p>• All MCP servers owned by this user will be deleted</p>}
            <p>• This action cannot be reversed</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmationValid || isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Delete User
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}