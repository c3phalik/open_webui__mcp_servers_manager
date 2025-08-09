'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { RefreshCw, ExternalLink, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react'

type MCPOStatus = 'starting' | 'running' | 'stopped' | 'error' | 'restarting' | 'stopping'

interface MCPOStatusData {
  healthStatus: 'healthy' | 'running_with_issues' | 'unhealthy'
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

interface MCPOUrlsData {
  mcpoRunning: boolean
  baseUrl: string
  totalServers: number
  servers: {
    [key: string]: {
      serverId: string
      baseUrl: string
      docsUrl: string
      openApiUrl: string
      schemaUrl: string
    }
  }
}

export default function MCPOStatus() {
  const [status, setStatus] = useState<MCPOStatusData | null>(null)
  const [urls, setUrls] = useState<MCPOUrlsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [restarting, setRestarting] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/mcpo/status')
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('Failed to fetch MCPO status:', error)
    }
  }

  const fetchUrls = async () => {
    try {
      const response = await fetch('/api/mcpo/urls')
      if (response.ok) {
        const data = await response.json()
        setUrls(data)
      }
    } catch (error) {
      console.error('Failed to fetch MCPO URLs:', error)
      setUrls(null)
    }
  }

  const handleRestart = async () => {
    setRestarting(true)
    try {
      const response = await fetch('/api/mcpo/restart', { method: 'POST' })
      const data = await response.json()
      
      if (response.ok) {
        console.log('MCPO restart initiated:', data)
        // Refresh status after a short delay
        setTimeout(() => {
          fetchStatus()
          fetchUrls()
        }, 2000)
      } else {
        console.error('Failed to restart MCPO:', data)
      }
    } catch (error) {
      console.error('Error restarting MCPO:', error)
    } finally {
      setTimeout(() => setRestarting(false), 3000) // Keep showing restart state for a bit
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchStatus(), fetchUrls()])
      setLoading(false)
    }

    loadData()

    // Set up auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchStatus()
      fetchUrls()
    }, 30000)

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

  const getStatusIcon = (status: MCPOStatus) => {
    switch (status) {
      case 'running': return <CheckCircle className="h-4 w-4" />
      case 'starting': case 'restarting': return <Clock className="h-4 w-4" />
      case 'error': case 'stopped': return <XCircle className="h-4 w-4" />
      default: return <AlertCircle className="h-4 w-4" />
    }
  }

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`
    if (minutes > 0) return `${minutes}m ${secs}s`
    return `${secs}s`
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>MCPO Status</CardTitle>
          <CardDescription>Loading process information...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">MCPO Status - Error</CardTitle>
          <CardDescription>Failed to load MCPO status information</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(status.process.status)}`} />
              <span>MCPO Status</span>
              {getStatusIcon(status.process.status)}
            </CardTitle>
            <CardDescription>
              Model Context Protocol OpenAPI Proxy - Last updated: {lastUpdate.toLocaleTimeString()}
            </CardDescription>
          </div>
          <Button 
            onClick={handleRestart} 
            disabled={restarting || status.process.status === 'starting'}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${restarting ? 'animate-spin' : ''}`} />
            {restarting ? 'Restarting...' : 'Restart'}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Health Status */}
        <div className="flex items-center space-x-2">
          <Badge variant={
            status.healthStatus === 'healthy' ? 'default' :
            status.healthStatus === 'running_with_issues' ? 'secondary' : 'destructive'
          }>
            {status.healthStatus.replace('_', ' ').toUpperCase()}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Status: {status.process.status}
          </span>
          {status.process.processId && (
            <span className="text-sm text-muted-foreground">
              PID: {status.process.processId}
            </span>
          )}
        </div>

        {/* Process Info */}
        {status.process.status === 'running' && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Uptime:</strong> {formatUptime(status.process.uptime)}
            </div>
            <div>
              <strong>Restart Count:</strong> {status.process.restartCount}
            </div>
            {status.process.lastRestart && (
              <div className="col-span-2">
                <strong>Last Restart:</strong> {new Date(status.process.lastRestart).toLocaleString()}
              </div>
            )}
          </div>
        )}

        {/* Server Status */}
        <div>
          <h4 className="font-medium mb-2">Server Configuration</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center space-x-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Valid Servers: {status.servers.totalValid}</span>
            </div>
            <div className="flex items-center space-x-1">
              <XCircle className="h-4 w-4 text-red-500" />
              <span>Invalid Servers: {status.servers.totalInvalid}</span>
            </div>
          </div>

          {/* Invalid Servers Details */}
          {status.servers.totalInvalid > 0 && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm">
              <strong>Invalid Servers:</strong>
              <ul className="mt-1 space-y-1">
                {Object.entries(status.servers.invalidServersDetails).map(([serverId, error]) => (
                  <li key={serverId} className="text-red-700">
                    <strong>{serverId}:</strong> {error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* MCPO URLs */}
        {urls && urls.mcpoRunning && (
          <>
            <Separator />
            <div>
              <h4 className="font-medium mb-2">Available Endpoints</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={urls.baseUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      MCPO Dashboard
                    </a>
                  </Button>
                  {urls.totalServers > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {urls.totalServers} active server{urls.totalServers !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                
                {/* Individual Server URLs */}
                {Object.entries(urls.servers).slice(0, 3).map(([serverId, server]) => (
                  <div key={serverId} className="flex items-center space-x-1 text-sm">
                    <Button variant="ghost" size="sm" asChild>
                      <a href={server.docsUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        {serverId} API
                      </a>
                    </Button>
                  </div>
                ))}
                
                {Object.keys(urls.servers).length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    ...and {Object.keys(urls.servers).length - 3} more servers
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* Error Info */}
        {status.errors.hasErrors && (
          <>
            <Separator />
            <div className="p-2 bg-red-50 border border-red-200 rounded">
              <h4 className="font-medium text-red-800 mb-1">Last Error</h4>
              <p className="text-sm text-red-700">{status.errors.lastError}</p>
            </div>
          </>
        )}

        {/* Recommendations */}
        {status.recommendations.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-medium mb-2">Recommendations</h4>
              <ul className="space-y-1 text-sm">
                {status.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start space-x-1">
                    <span>•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}