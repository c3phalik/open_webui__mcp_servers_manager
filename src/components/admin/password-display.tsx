"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

interface PasswordDisplayProps {
  password: string
  label?: string
  className?: string
}

export function PasswordDisplay({ password, label = "Password", className }: PasswordDisplayProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      toast.success('Password copied to clipboard')
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy password:', error)
      toast.error('Failed to copy password')
    }
  }

  return (
    <div className={className}>
      <Label htmlFor="password-display" className="text-sm font-medium">
        {label}
      </Label>
      <div className="flex gap-2 mt-1.5">
        <div className="relative flex-1">
          <Input
            id="password-display"
            type={showPassword ? "text" : "password"}
            value={password}
            readOnly
            className="pr-10 font-mono text-sm"
            placeholder="Generated password will appear here"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={copyToClipboard}
          className="px-3"
          disabled={!password}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-green-500" />
              <span className="ml-1 text-green-500">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              <span className="ml-1">Copy</span>
            </>
          )}
        </Button>
      </div>
      
      {password && (
        <div className="mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>Length: {password.length}</span>
            <span className="text-green-600">● Strong password</span>
            <span>Contains: A-z, 0-9, symbols</span>
          </div>
        </div>
      )}
    </div>
  )
}