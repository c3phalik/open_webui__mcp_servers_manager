'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { useAuth } from '@/components/auth/session-provider'
import { 
  RefreshCw, 
  ExternalLink, 
  CheckCircle, 
  XCircle, 
  Activity,
  Monitor,
  Play,
  Square,
  RotateCcw,
  AlertTriangle,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronUp,
  Skull,
  MoreVertical,
  Clock,
  Server
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type HealthStatus = 'healthy' | 'running_with_issues' | 'unhealthy'
type MCPOStatus = 'starting' | 'running' | 'stopped' | 'error' | 'restarting' | 'stopping'

interface MCPOApiResponse {
  healthStatus: HealthStatus
  timestamp: string
  process: {
    status: MCPOStatus
    processId: number | null
    uptime: number
    restartCount: number
    lastRestart: string | null
    configFile: string | null
    mcpoUrl: string
  }
  servers: {
    totalValid: number
    totalInvalid: number
    validServersList: string[]
    invalidServersDetails: { [key: string]: string }
  }
  errors: {
    lastError: string | null
    hasErrors: boolean
  }
  recommendations: string[]
}

export default function MCPOStatusCompact() {
  const { isAdmin } = useAuth()
  const [data, setData] = useState<MCPOApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchStatus = async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true)
      const response = await fetch('/api/mcpo/status')
      if (response.ok) {
        const apiData = await response.json()
        setData(apiData)
        setLastUpdate(new Date())
      } else {
        console.error('Failed to fetch MCPO status:', response.statusText)
      }
    } catch (error) {
      console.error('Error fetching MCPO status:', error)
    } finally {
      if (showLoader) setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus(true)
    
    // Smart polling: more frequent when issues detected
    const getPollingInterval = () => {
      if (!data) return 30000
      return data.healthStatus === 'healthy' ? 30000 : 10000
    }
    
    const interval = setInterval(() => fetchStatus(), getPollingInterval())
    return () => clearInterval(interval)
  }, [data?.healthStatus])

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    setActionLoading(action)
    try {
      const response = await fetch(`/api/mcpo/${action}`, { method: 'POST' })
      if (response.ok) {
        toast.success(`MCPO ${action} initiated successfully`)
        // Fetch status immediately after action
        setTimeout(() => fetchStatus(), 1000)
      } else {
        const error = await response.text()
        toast.error(`Failed to ${action} MCPO: ${error}`)
      }
    } catch (error) {
      toast.error(`Error during ${action}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleKillAll = async () => {
    setActionLoading('kill-all')
    try {
      const response = await fetch('/api/mcpo/kill-all', { method: 'POST' })
      if (response.ok) {
        const data = await response.json()
        toast.success(data.message || 'Kill signal sent to all MCPO processes')
        // Fetch status immediately after action
        setTimeout(() => fetchStatus(), 1000)
      } else {
        const error = await response.text()
        toast.error(`Failed to kill MCPO processes: ${error}`)
      }
    } catch (error) {
      toast.error(`Error killing MCPO processes: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setActionLoading(null)
    }
  }

  const getHealthConfig = (healthStatus: HealthStatus, processStatus: MCPOStatus) => {
    if (loading || !data) {
      return {
        color: 'bg-gray-400',
        badgeVariant: 'secondary' as const,
        icon: RefreshCw,
        statusText: 'Loading...',
        animate: true
      }
    }

    // Override health status based on process status
    if (processStatus === 'stopped') {
      return {
        color: 'bg-gray-500',
        badgeVariant: 'secondary' as const,
        icon: WifiOff,
        statusText: 'Offline',
        animate: false
      }
    }

    if (['starting', 'restarting'].includes(processStatus)) {
      return {
        color: 'bg-blue-500',
        badgeVariant: 'secondary' as const,
        icon: RefreshCw,
        statusText: processStatus === 'starting' ? 'Starting...' : 'Restarting...',
        animate: true
      }
    }

    switch (healthStatus) {
      case 'healthy':
        return {
          color: 'bg-green-500',
          badgeVariant: 'default' as const,
          icon: CheckCircle,
          statusText: 'Healthy',
          animate: false
        }
      case 'running_with_issues':
        return {
          color: 'bg-yellow-500',
          badgeVariant: 'secondary' as const,
          icon: AlertTriangle,
          statusText: 'Issues',
          animate: true
        }
      case 'unhealthy':
        return {
          color: 'bg-red-500',
          badgeVariant: 'destructive' as const,
          icon: XCircle,
          statusText: 'Unhealthy',
          animate: false
        }
      default:
        return {
          color: 'bg-gray-500',
          badgeVariant: 'outline' as const,
          icon: WifiOff,
          statusText: 'Unknown',
          animate: false
        }
    }
  }

  const formatUptime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ${minutes % 60}m`
  }

  const getAvailableActions = () => {
    if (!data) return []
    const status = data.process.status
    
    switch (status) {
      case 'stopped':
      case 'error':
        return ['start']
      case 'running':
        return ['stop', 'restart']
      case 'starting':
      case 'stopping':
      case 'restarting':
        return [] // No actions during transitions
      default:
        return []
    }
  }

  const getPrimaryAction = () => {
    if (!data) return null
    
    const status = data.process.status
    switch (status) {
      case 'stopped':
      case 'error':
        return { action: 'start', icon: Play, label: 'Start', variant: 'default' as const }
      case 'running':
        return { action: 'stop', icon: Square, label: 'Stop', variant: 'outline' as const }
      case 'starting':
      case 'stopping':
      case 'restarting':
        return null // No primary action during transitions
      default:
        return null
    }
  }

  const renderActionsMenu = () => {
    if (!data) return null
    
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {/* Process Control Actions */}
          <DropdownMenuItem 
            onClick={() => handleAction('start')}
            disabled={data.process.status === 'running' || !!actionLoading}
          >
            <Play className="mr-2 h-4 w-4" />
            Start MCPO
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={() => handleAction('stop')}
            disabled={data.process.status === 'stopped' || !!actionLoading}
          >
            <Square className="mr-2 h-4 w-4" />
            Stop MCPO
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={() => handleAction('restart')}
            disabled={!!actionLoading}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Restart MCPO
          </DropdownMenuItem>
          
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleKillAll}
                disabled={!!actionLoading}
                className="text-destructive focus:text-destructive"
              >
                <Skull className="mr-2 h-4 w-4" />
                Kill All MCPO
              </DropdownMenuItem>
            </>
          )}
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem asChild>
            <Link href="/monitor" className="flex items-center">
              <Monitor className="mr-2 h-4 w-4" />
              Monitor Page
            </Link>
          </DropdownMenuItem>
          
          {data.process.mcpoUrl && (
            <DropdownMenuItem asChild>
              <a href={data.process.mcpoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open MCPO
              </a>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  if (loading && !data) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 bg-gray-400 rounded-full animate-pulse" />
            <div className="flex-1">
              <div className="h-4 bg-muted rounded animate-pulse mb-1" />
              <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 bg-red-500 rounded-full" />
            <div className="flex-1">
              <div className="text-sm font-medium text-destructive">Connection Failed</div>
              <div className="text-xs text-muted-foreground">Unable to reach MCPO</div>
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchStatus(true)}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const healthConfig = getHealthConfig(data.healthStatus, data.process.status)
  const primaryAction = getPrimaryAction()
  const hasIssues = data.recommendations.length > 0 || data.errors.hasErrors

  return (
    <Card className="w-80 transition-all duration-200 hover:shadow-sm">
      <CardContent className="p-5">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${healthConfig.color} ${healthConfig.animate ? 'animate-pulse' : ''}`} />
            <span className="font-semibold text-base">MCPO</span>
            <Badge variant={healthConfig.badgeVariant} className="text-xs">
              {healthConfig.statusText}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {primaryAction && (
              <Button
                variant={primaryAction.variant}
                size="sm"
                onClick={() => handleAction(primaryAction.action as 'start' | 'stop' | 'restart')}
                disabled={!!actionLoading}
                className="h-8 px-3"
              >
                {actionLoading === primaryAction.action ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <primaryAction.icon className="h-3.5 w-3.5 mr-1" />
                )}
                {primaryAction.label}
              </Button>
            )}
            
            {renderActionsMenu()}
          </div>
        </div>

        {/* Primary Metrics */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Server className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {data.servers.totalValid} server{data.servers.totalValid !== 1 ? 's' : ''} running
              </span>
              {data.servers.totalInvalid > 0 && (
                <span className="text-red-500">({data.servers.totalInvalid} errors)</span>
              )}
            </div>

            {data.process.status === 'running' && data.process.uptime > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Wifi className="h-3 w-3" />
                <span>{formatUptime(data.process.uptime)}</span>
              </div>
            )}
          </div>

          {/* Expandable Details Section */}
          <div className="border-t pt-3">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showDetails ? 
                  <ChevronUp className="h-3 w-3" /> : 
                  <ChevronDown className="h-3 w-3" />
                }
                Show details
                {hasIssues && !showDetails && (
                  <div className="h-1.5 w-1.5 bg-yellow-500 rounded-full" />
                )}
              </button>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchStatus()}
                  className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                  disabled={loading}
                >
                  <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                
                <span className="text-xs text-muted-foreground">
                  {new Date(lastUpdate).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
            </div>

            {/* Collapsible Details */}
            {showDetails && (
              <div className="mt-4 space-y-4 text-xs">
                {/* Detailed Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Process ID</span>
                    <div className="font-mono">{data.process.processId || 'N/A'}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Restarts</span>
                    <div>{data.process.restartCount}</div>
                  </div>
                </div>

                {/* Recommendations */}
                {data.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1 text-yellow-600">
                      <AlertTriangle className="h-3 w-3" />
                      <span className="font-medium">Recommendations</span>
                    </div>
                    <div className="space-y-1">
                      {data.recommendations.slice(0, 2).map((rec, index) => (
                        <div key={index} className="text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                          {rec}
                        </div>
                      ))}
                      {data.recommendations.length > 2 && (
                        <div className="text-center text-muted-foreground">
                          +{data.recommendations.length - 2} more in monitor
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Errors */}
                {data.errors.hasErrors && data.errors.lastError && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1 text-red-600">
                      <XCircle className="h-3 w-3" />
                      <span className="font-medium">Last Error</span>
                    </div>
                    <div className="text-red-600 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded px-2 py-1.5">
                      {data.errors.lastError}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}