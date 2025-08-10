"use client"

import { useState, useEffect } from 'react'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  RefreshCw,
  Skull,
  Cpu,
  MemoryStick,
  Hash,
  Zap,
  TrendingUp
} from 'lucide-react'
import { toast } from 'sonner'

interface MCPOMonitorData {
  healthStatus: 'healthy' | 'running_with_issues' | 'unhealthy'
  timestamp: string
  process: {
    status: 'starting' | 'running' | 'stopped' | 'error' | 'restarting' | 'stopping'
    processId: number | null
    uptime: number
    restartCount: number
    lastRestart: Date | null
    configFile: string | null
    mcpoUrl: string
  }
  servers: {
    totalValid: number
    totalInvalid: number
    validServersList: any[]
    invalidServersDetails: any[]
  }
  errors: {
    lastError: string | null
    hasErrors: boolean
  }
  monitoring: {
    recentLogs: string[]
    statusHistory: Array<{
      status: string
      timestamp: Date
      message?: string
    }>
  }
  recommendations: string[]
}

interface ProcessInfo {
  pid: number
  user: string
  cpu: number
  memory: number
  vsz: number
  rss: number
  tty: string
  stat: string
  start: string
  time: string
  command: string
  ports: number[]
}

interface ProcessData {
  success: boolean
  processes: ProcessInfo[]
  summary: {
    totalProcesses: number
    totalCpu: number
    totalMemory: number
    totalRss: number
    pids: number[]
    ports: number[]
    totalPorts: number
  }
  timestamp: string
}

export default function MonitorPage() {
  const [monitorData, setMonitorData] = useState<MCPOMonitorData | null>(null)
  const [processData, setProcessData] = useState<ProcessData | null>(null)
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

  const fetchProcessData = async () => {
    try {
      const response = await fetch('/api/mcpo/processes')
      if (response.ok) {
        const data = await response.json()
        setProcessData(data)
      }
    } catch (error) {
      console.error('Failed to fetch process data:', error)
    }
  }

  useEffect(() => {
    fetchMonitorData()
    fetchLogs()
    fetchProcessData()

    // Set up EventSource for real-time updates
    const eventSource = new EventSource('/api/mcpo/monitor')
    
    eventSource.onmessage = (event) => {
      try {
        const eventData = JSON.parse(event.data)
        
        // Transform the flat SSE data to match our nested interface
        if (eventData.data) {
          const flatData = eventData.data
          
          // Check if it's already in new format or needs transformation
          if (flatData.process) {
            // Already in new format, use directly
            setMonitorData(flatData)
          } else {
            // Transform flat structure to nested structure
            const transformedData = {
              healthStatus: flatData.status === 'running' && flatData.validServers > 0 && !flatData.lastError ? 'healthy' :
                           flatData.status === 'running' && flatData.validServers > 0 ? 'running_with_issues' :
                           'unhealthy',
              timestamp: new Date().toISOString(),
              process: {
                status: flatData.status,
                processId: flatData.processId,
                uptime: flatData.uptime,
                restartCount: flatData.restartCount,
                lastRestart: flatData.lastRestart,
                configFile: flatData.configFile,
                mcpoUrl: flatData.mcpoUrl
              },
              servers: {
                totalValid: flatData.validServers,
                totalInvalid: flatData.invalidServers,
                validServersList: [],
                invalidServersDetails: []
              },
              errors: {
                lastError: flatData.lastError,
                hasErrors: !!flatData.lastError
              },
              monitoring: {
                recentLogs: flatData.recentLogs || [],
                statusHistory: flatData.statusHistory || []
              },
              recommendations: []
            }
            
            setMonitorData(transformedData)
          }
        }
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
      fetchProcessData()
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

  const handleKillAll = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/mcpo/kill-all', { method: 'POST' })
      
      if (response.ok) {
        const data = await response.json()
        toast.success(data.message || 'Kill signal sent to all MCPO processes')
        await fetchMonitorData()
        await fetchLogs()
        await fetchProcessData()
      } else {
        const error = await response.text()
        toast.error(`Failed to kill MCPO processes: ${error}`)
      }
    } catch (error) {
      toast.error(`Error killing MCPO processes: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKillProcess = async (pid: number) => {
    try {
      const response = await fetch(`/api/mcpo/processes/${pid}`, { method: 'DELETE' })
      
      if (response.ok) {
        const data = await response.json()
        toast.success(data.message || `Process ${pid} terminated`)
        await fetchProcessData()
        await fetchMonitorData()
      } else {
        const error = await response.text()
        toast.error(`Failed to kill process ${pid}: ${error}`)
      }
    } catch (error) {
      toast.error(`Error killing process ${pid}: ${error}`)
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

  const getHistoryStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'starting':
        return <Play className="h-4 w-4 text-yellow-500" />
      case 'stopping':
        return <Square className="h-4 w-4 text-yellow-500" />
      case 'restarting':
        return <RotateCcw className="h-4 w-4 text-yellow-500" />
      case 'stopped':
        return <Square className="h-4 w-4 text-gray-500" />
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
                  fetchProcessData()
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
            {/* Enhanced Status Overview */}
            <div className="grid gap-4 md:grid-cols-4 mb-8">
              {/* Primary Process Status */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Primary Process</CardTitle>
                  {getStatusIcon(monitorData.process.status)}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${getStatusColor(monitorData.process.status)}`}></div>
                      <span className="text-xl font-bold capitalize">{monitorData.process.status}</span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>PID: {monitorData.process.processId || 'N/A'}</div>
                      {monitorData.process.status === 'running' && monitorData.process.uptime > 0 && (
                        <div>Uptime: {formatUptime(monitorData.process.uptime)}</div>
                      )}
                    </div>
                    {monitorData.errors.lastError && (
                      <p className="text-xs text-red-500 line-clamp-2">{monitorData.errors.lastError}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Active Processes */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Processes</CardTitle>
                  <Hash className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-2xl font-bold">
                      {processData?.summary.totalProcesses || 0}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      {processData?.summary.pids && processData.summary.pids.length > 0 ? (
                        <div>PIDs: {processData.summary.pids.slice(0, 3).join(', ')}{processData.summary.pids.length > 3 && '...'}</div>
                      ) : (
                        <div>No MCPO processes found</div>
                      )}
                      {processData?.summary.ports && processData.summary.ports.length > 0 && (
                        <div>Ports: {processData.summary.ports.slice(0, 3).join(', ')}{processData.summary.ports.length > 3 && '...'}</div>
                      )}
                      {processData?.timestamp && (
                        <div>Last scan: {new Date(processData.timestamp).toLocaleTimeString()}</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* System Resources */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">System Resources</CardTitle>
                  <div className="flex gap-1">
                    <Cpu className="h-3 w-3 text-muted-foreground" />
                    <MemoryStick className="h-3 w-3 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-xl font-bold">
                      {processData?.summary.totalCpu?.toFixed(1) || '0.0'}%
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>CPU Usage</div>
                      {processData?.summary.totalRss && (
                        <div>RAM: {(processData.summary.totalRss / 1024).toFixed(1)} MB</div>
                      )}
                      {processData?.summary.totalMemory && (
                        <div>Memory: {processData.summary.totalMemory.toFixed(1)}%</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Health & Performance */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Health & Performance</CardTitle>
                  <div className="flex gap-1">
                    <Server className="h-3 w-3 text-muted-foreground" />
                    <TrendingUp className="h-3 w-3 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-xl font-bold text-green-600">
                      {monitorData.servers.totalValid}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>Valid Servers</div>
                      {monitorData.servers.totalInvalid > 0 && (
                        <div className="text-red-500">{monitorData.servers.totalInvalid} invalid</div>
                      )}
                      <div>Restarts: {monitorData.process.restartCount}</div>
                      {processData?.summary.totalPorts ? (
                        <div className="text-blue-500">{processData.summary.totalPorts} port{processData.summary.totalPorts !== 1 ? 's' : ''} active</div>
                      ) : monitorData.process.mcpoUrl ? (
                        <div className="text-blue-500">Port active</div>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs for detailed info */}
            <Tabs defaultValue="logs" className="space-y-4">
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="logs">Process Logs</TabsTrigger>
                  <TabsTrigger value="history">Status History</TabsTrigger>
                  <TabsTrigger value="config">Configuration</TabsTrigger>
                  <TabsTrigger value="processes">Processes</TabsTrigger>
                </TabsList>
                
                {/* Control Buttons - Right aligned with tabs */}
                <div className="flex items-center gap-2">
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleAction('start')}
                      disabled={monitorData.process.status === 'running' || isLoading}
                      size="sm"
                      className="gap-1.5"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Start
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => handleAction('stop')}
                      disabled={monitorData.process.status === 'stopped' || isLoading}
                      size="sm"
                      className="gap-1.5"
                    >
                      <Square className="h-3.5 w-3.5" />
                      Stop
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => handleAction('restart')}
                      disabled={isLoading}
                      size="sm"
                      className="gap-1.5"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restart
                    </Button>
                  </div>

                  <div className="h-6 w-px bg-border mx-1" />

                  <div className="flex gap-2">
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
                      size="sm"
                      className="gap-1.5"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Config
                    </Button>

                    {monitorData.process.mcpoUrl && (
                      <Button
                        variant="outline"
                        asChild
                        size="sm"
                        className="gap-1.5"
                      >
                        <a href={monitorData.process.mcpoUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open
                        </a>
                      </Button>
                    )}
                  </div>

                  <div className="h-6 w-px bg-border mx-1" />

                  <Button
                    variant="destructive"
                    onClick={handleKillAll}
                    disabled={isLoading}
                    size="sm"
                    className="gap-1.5"
                  >
                    <Skull className="h-3.5 w-3.5" />
                    Kill All
                  </Button>
                </div>
              </div>

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
                      {monitorData.monitoring.statusHistory && monitorData.monitoring.statusHistory.length > 0 ? (
                        // Reverse the array to show latest first
                        [...monitorData.monitoring.statusHistory].reverse().map((entry, index) => (
                          <div key={index} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                            {getHistoryStatusIcon(entry.status)}
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
                        {monitorData.process.configFile || 'No config file generated'}
                      </p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">MCPO URL</label>
                      <p className="text-sm text-muted-foreground">
                        {monitorData.process.mcpoUrl || 'Not running'}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Server Statistics</label>
                      <div className="flex gap-4 mt-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm">{monitorData.servers.totalValid} Valid</span>
                        </div>
                        {monitorData.servers.totalInvalid > 0 && (
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span className="text-sm">{monitorData.servers.totalInvalid} Invalid</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="processes">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      Active Processes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {processData ? (
                      <>
                        <div className="mb-4 text-sm text-muted-foreground">
                          Found {processData.summary.totalProcesses} MCPO-related process{processData.summary.totalProcesses !== 1 ? 'es' : ''} 
                          {processData.timestamp && (
                            <> • Last updated: {new Date(processData.timestamp).toLocaleTimeString()}</>
                          )}
                        </div>
                        
                        {processData.processes.length > 0 ? (
                          <div className="border rounded-md">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-20">PID</TableHead>
                                  <TableHead className="w-20">User</TableHead>
                                  <TableHead className="w-16">CPU%</TableHead>
                                  <TableHead className="w-16">MEM%</TableHead>
                                  <TableHead className="w-24">Memory</TableHead>
                                  <TableHead className="w-24">Ports</TableHead>
                                  <TableHead className="w-16">Status</TableHead>
                                  <TableHead className="w-20">Started</TableHead>
                                  <TableHead>Command</TableHead>
                                  <TableHead className="w-20">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {processData.processes.map((process) => (
                                  <TableRow key={process.pid}>
                                    <TableCell className="font-mono text-sm">{process.pid}</TableCell>
                                    <TableCell className="text-sm">{process.user}</TableCell>
                                    <TableCell className="text-sm font-mono">
                                      <span className={process.cpu > 5 ? 'text-orange-600' : 'text-muted-foreground'}>
                                        {process.cpu.toFixed(1)}%
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-sm font-mono">
                                      <span className={process.memory > 2 ? 'text-orange-600' : 'text-muted-foreground'}>
                                        {process.memory.toFixed(1)}%
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-sm font-mono text-muted-foreground">
                                      {(process.rss / 1024).toFixed(1)}MB
                                    </TableCell>
                                    <TableCell>
                                      {process.ports.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                          {process.ports.map((port) => (
                                            <Badge key={port} variant="outline" className="text-xs font-mono">
                                              {port}
                                            </Badge>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={process.stat.includes('S') ? 'secondary' : 'outline'} className="text-xs">
                                        {process.stat}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{process.start}</TableCell>
                                    <TableCell className="max-w-md">
                                      <div className="text-sm font-mono text-muted-foreground truncate" title={process.command}>
                                        {process.command}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => handleKillProcess(process.pid)}
                                        className="h-7 px-2"
                                        disabled={isLoading}
                                      >
                                        <XCircle className="h-3 w-3" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <Hash className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p>No MCPO processes found</p>
                            <p className="text-sm mt-1">All processes have been terminated or no MCPO instances are running</p>
                          </div>
                        )}

                        {processData.summary.totalProcesses > 0 && (
                          <div className="mt-4 pt-4 border-t space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Total CPU:</span>
                                <div className="font-mono font-semibold">{processData.summary.totalCpu.toFixed(1)}%</div>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Total Memory:</span>
                                <div className="font-mono font-semibold">{processData.summary.totalMemory.toFixed(1)}%</div>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Total RAM:</span>
                                <div className="font-mono font-semibold">{(processData.summary.totalRss / 1024).toFixed(1)} MB</div>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Processes:</span>
                                <div className="font-semibold">{processData.summary.totalProcesses}</div>
                              </div>
                            </div>
                            
                            {processData.summary.ports.length > 0 && (
                              <div>
                                <span className="text-muted-foreground text-sm">Active Ports:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {processData.summary.ports.map((port) => (
                                    <Badge key={port} variant="secondary" className="text-xs font-mono">
                                      {port}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">Loading process data...</p>
                      </div>
                    )}
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