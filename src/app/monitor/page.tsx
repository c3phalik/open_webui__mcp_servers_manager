"use client"

import { useState, useEffect } from 'react'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Play, 
  Square, 
  RotateCcw, 
  Activity, 
  Server, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Terminal,
  Globe,
  ExternalLink,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'

interface MCPOMonitorData {
  status: 'starting' | 'running' | 'stopped' | 'error' | 'restarting' | 'stopping'
  uptime: number
  processId: number | null
  lastRestart: Date | null
  restartCount: number
  validServers: number
  invalidServers: number
  recentLogs: string[]
  statusHistory: Array<{
    status: string
    timestamp: Date
    message?: string
  }>
  mcpoUrl: string
  configFile: string | null
  lastError: string | null
}

export default function MonitorPage() {
  const [monitorData, setMonitorData] = useState<MCPOMonitorData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [logs, setLogs] = useState<string[]>([])

  const fetchMonitorData = async () => {
    try {
      const response = await fetch('/api/mcpo/status')
      if (response.ok) {
        const data = await response.json()
        setMonitorData(data)
      }
    } catch (error) {
      console.error('Failed to fetch monitor data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/mcpo/logs?limit=100')
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs || [])
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    }
  }

  useEffect(() => {
    fetchMonitorData()
    fetchLogs()

    // Set up EventSource for real-time updates
    const eventSource = new EventSource('/api/mcpo/monitor')
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setMonitorData(data)
      } catch (error) {
        console.error('Failed to parse SSE data:', error)
      }
    }

    eventSource.onerror = () => {
      console.error('SSE connection error')
    }

    // Auto-refresh interval as backup
    const interval = autoRefresh ? setInterval(() => {
      fetchMonitorData()
      fetchLogs()
    }, 5000) : null

    return () => {
      eventSource.close()
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh])

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/mcpo/${action}`, { method: 'POST' })
      
      if (response.ok) {
        toast.success(`MCPO ${action} initiated`)
        await fetchMonitorData()
        await fetchLogs()
      } else {
        const error = await response.text()
        toast.error(`Failed to ${action} MCPO: ${error}`)
      }
    } catch (error) {
      toast.error(`Error during ${action}: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'starting':
      case 'stopping':
      case 'restarting':
        return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500'
      case 'error': return 'bg-red-500'
      case 'starting':
      case 'stopping':
      case 'restarting': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  const formatUptime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ${minutes % 60}m`
  }

  return (
    <ProtectedRoute requireAdmin={true}>
      {isLoading && !monitorData ? (
        <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading monitor data...</span>
          </div>
        </div>
      ) : (
        <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-background via-background to-muted/20">
          <div className="container mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  MCPO Monitor
                </h1>
                <p className="text-muted-foreground">
                  Real-time monitoring and control of MCPO subprocess
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  fetchMonitorData()
                  fetchLogs()
                }}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                Auto Refresh
              </Button>
            </div>
          </div>
        </div>

        {monitorData && (
          <>
            {/* Status Overview */}
            <div className="grid gap-4 md:grid-cols-4 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Status</CardTitle>
                  {getStatusIcon(monitorData.status)}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${getStatusColor(monitorData.status)}`}></div>
                    <span className="text-2xl font-bold capitalize">{monitorData.status}</span>
                  </div>
                  {monitorData.lastError && (
                    <p className="text-xs text-red-500 mt-1 line-clamp-2">{monitorData.lastError}</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatUptime(monitorData.uptime)}</div>
                  <p className="text-xs text-muted-foreground">
                    PID: {monitorData.processId || 'N/A'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Servers</CardTitle>
                  <Server className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{monitorData.validServers}</div>
                  {monitorData.invalidServers > 0 && (
                    <p className="text-xs text-red-500">{monitorData.invalidServers} invalid</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Restarts</CardTitle>
                  <RotateCcw className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{monitorData.restartCount}</div>
                  {monitorData.lastRestart && (
                    <p className="text-xs text-muted-foreground">
                      Last: {new Date(monitorData.lastRestart).toLocaleTimeString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Controls */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Controls</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleAction('start')}
                    disabled={monitorData.status === 'running' || isLoading}
                    className="gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Start
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => handleAction('stop')}
                    disabled={monitorData.status === 'stopped' || isLoading}
                    className="gap-2"
                  >
                    <Square className="h-4 w-4" />
                    Stop
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => handleAction('restart')}
                    disabled={isLoading}
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Restart
                  </Button>

                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        setIsLoading(true)
                        const response = await fetch('/api/mcpo/regenerate-config', { method: 'POST' })
                        if (response.ok) {
                          toast.success('Config regenerated successfully')
                          await fetchMonitorData()
                        } else {
                          const error = await response.text()
                          toast.error(`Failed to regenerate config: ${error}`)
                        }
                      } catch (error) {
                        toast.error(`Error regenerating config: ${error}`)
                      } finally {
                        setIsLoading(false)
                      }
                    }}
                    disabled={isLoading}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Regenerate Config
                  </Button>

                  {monitorData.mcpoUrl && (
                    <Button
                      variant="outline"
                      asChild
                      className="gap-2"
                    >
                      <a href={monitorData.mcpoUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Open MCPO
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Tabs for detailed info */}
            <Tabs defaultValue="logs" className="space-y-4">
              <TabsList>
                <TabsTrigger value="logs">Process Logs</TabsTrigger>
                <TabsTrigger value="history">Status History</TabsTrigger>
                <TabsTrigger value="config">Configuration</TabsTrigger>
              </TabsList>

              <TabsContent value="logs">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Terminal className="h-4 w-4" />
                      Process Logs
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-black rounded-md p-4 font-mono text-sm text-green-400 h-96 overflow-y-auto">
                      {logs.length === 0 ? (
                        <div className="text-gray-500">No logs available</div>
                      ) : (
                        logs.map((log, index) => (
                          <div key={index} className="whitespace-pre-wrap break-all">
                            {log}
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history">
                <Card>
                  <CardHeader>
                    <CardTitle>Status History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {monitorData.statusHistory && monitorData.statusHistory.length > 0 ? (
                        monitorData.statusHistory.map((entry, index) => (
                          <div key={index} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                            {getStatusIcon(entry.status)}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="capitalize">
                                  {entry.status}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {new Date(entry.timestamp).toLocaleString()}
                                </span>
                              </div>
                              {entry.message && (
                                <p className="text-sm text-muted-foreground mt-1">{entry.message}</p>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-muted-foreground py-4">
                          No status history available
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="config">
                <Card>
                  <CardHeader>
                    <CardTitle>Configuration Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Config File</label>
                      <p className="text-sm text-muted-foreground font-mono">
                        {monitorData.configFile || 'No config file generated'}
                      </p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">MCPO URL</label>
                      <p className="text-sm text-muted-foreground">
                        {monitorData.mcpoUrl || 'Not running'}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Server Statistics</label>
                      <div className="flex gap-4 mt-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm">{monitorData.validServers} Valid</span>
                        </div>
                        {monitorData.invalidServers > 0 && (
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span className="text-sm">{monitorData.invalidServers} Invalid</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
          </div>
        </div>
      )}
    </ProtectedRoute>
  )
}