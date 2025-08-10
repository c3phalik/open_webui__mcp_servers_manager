"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Server, Activity, Users, Home } from 'lucide-react'
import { UserNav } from './auth/user-nav'
import { ThemeToggle } from './theme-toggle'
import { useAuth } from './auth/session-provider'

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "MCP Manager" || "Untitled"

export function Navbar() {
  const pathname = usePathname()
  const { isAdmin } = useAuth()

  // Don't show navbar on auth pages
  if (pathname === '/login' || pathname === '/signup') {
    return null
  }

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(path)
  }

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo and main navigation */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 rounded-md">
                <Server className="h-5 w-5 text-primary" />
              </div>
              <span className="font-semibold text-lg">{APP_NAME}</span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                asChild
                className={`gap-2 ${isActive('/') ? 'bg-muted/70 text-foreground' : 'hover:bg-muted/50'}`}
              >
                <Link href="/">
                  <Home className="h-4 w-4" />
                  Servers
                </Link>
              </Button>

              {isAdmin && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className={`gap-2 ${isActive('/monitor') ? 'bg-muted/70 text-foreground' : 'hover:bg-muted/50'}`}
                  >
                    <Link href="/monitor">
                      <Activity className="h-4 w-4" />
                      Monitor
                    </Link>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className={`gap-2 ${isActive('/admin') ? 'bg-muted/70 text-foreground' : 'hover:bg-muted/50'}`}
                  >
                    <Link href="/admin/users">
                      <Users className="h-4 w-4" />
                      Admin
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* User navigation */}
          <div className="flex items-center gap-2">
            {/* Mobile menu - simplified for now */}
            <div className="md:hidden">
              {isAdmin && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className={isActive('/monitor') ? 'bg-muted/70 text-foreground' : 'hover:bg-muted/50'}
                  >
                    <Link href="/monitor">
                      <Activity className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className={isActive('/admin') ? 'bg-muted/70 text-foreground' : 'hover:bg-muted/50'}
                  >
                    <Link href="/admin/users">
                      <Users className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              )}
            </div>
            <ThemeToggle />
            <UserNav />
          </div>
        </div>
      </div>
    </nav>
  )
}