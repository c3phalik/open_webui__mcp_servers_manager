"use client"

import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LogOut, User, Shield } from 'lucide-react'
import { useAuth } from './session-provider'
import { signOut } from '@/lib/auth-client'

export function UserNav() {
  const { user, isAdmin } = useAuth()
  
  if (!user) return null

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/login'
  }

  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase()
    : user.email.slice(0, 2).toUpperCase()

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            {user.name || user.email}
          </span>
          {isAdmin && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Shield className="h-3 w-3" />
              Admin
            </div>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSignOut}
        className="h-8 px-2"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  )
}