'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { 
  RefreshCw, 
  ExternalLink, 
  CheckCircle, 
  XCircle, 
  Activity,
  Monitor,
  ArrowRight
} from 'lucide-react'

type MCPOStatus = 'starting' | 'running' | 'stopped' | 'error' | 'restarting' | 'stopping'

interface CompactStatusData {
  status: MCPOStatus
  uptime: number
  validServers: number
  invalidServers: number
  mcpoUrl: string
  lastError: string | null
}

export default function MCPOStatusCompact() {
  const [status, setStatus] = useState<CompactStatusData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/mcpo/status')
      if (response.ok) {
        const data = await response.json()
        // Transform the full status data to compact format
        setStatus({
          status: data.status,
          uptime: data.uptime || 0,
          validServers: data.validServers || 0,
          invalidServers: data.invalidServers || 0,
          mcpoUrl: data.mcpoUrl || '',
          lastError: data.lastError
        })
      }
    } catch (error) {
      console.error('Failed to fetch MCPO status:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: MCPOStatus) => {
    switch (status) {
      case 'running': return 'bg-green-500'
      case 'starting': case 'restarting': return 'bg-yellow-500'
      case 'stopping': return 'bg-orange-500'
      case 'stopped': case 'error': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusBadgeVariant = (status: MCPOStatus) => {
    switch (status) {
      case 'running': return 'default'
      case 'starting': case 'restarting': return 'secondary'
      case 'error': case 'stopped': return 'destructive'
      default: return 'outline'
    }
  }

  const formatUptime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ${minutes % 60}m`
  }

  if (loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading MCPO status...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!status) {
    return (
      <Card className="border-red-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-600">Failed to load MCPO status</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${getStatusColor(status.status)}`}></div>
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">MCPO</span>
            </div>
            
            <Badge variant={getStatusBadgeVariant(status.status)} className="text-xs capitalize">
              {status.status}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/monitor">
              <Button variant="ghost" size="sm" className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                <Monitor className="h-3 w-3 mr-1" />
                Monitor
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
            
            {status.mcpoUrl && (
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <a href={status.mcpoUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          {status.status === 'running' && (
            <div className="flex items-center gap-1">
              <span>Uptime: {formatUptime(status.uptime)}</span>
            </div>
          )}
          
          <div className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-green-500" />
            <span>{status.validServers} servers</span>
          </div>

          {status.invalidServers > 0 && (
            <div className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              <span>{status.invalidServers} errors</span>
            </div>
          )}
        </div>

        {status.lastError && status.status === 'error' && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600 line-clamp-2">
            {status.lastError}
          </div>
        )}
      </CardContent>
    </Card>
  )
}