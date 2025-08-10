"use client"

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, ChevronDown } from 'lucide-react'
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

  const displayName = user.name || user.email
  const email = user.email

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 px-4 hover:bg-muted/50">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-sm font-medium truncate max-w-[150px]">
                {displayName}
              </span>
              {isAdmin && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  Admin
                </Badge>
              )}
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={5} alignOffset={0}>
        <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}