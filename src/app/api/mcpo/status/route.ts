import { NextRequest, NextResponse } from 'next/server'
import { adminMiddleware } from '@/lib/auth-middleware'
import mcpoManager from '@/lib/mcpo-manager'

export const GET = adminMiddleware(async (request: NextRequest, userContext) => {
  try {
    const status = mcpoManager.getStatus()
    
    // Generate health assessment
    const healthStatus = 
      status.status === 'running' && status.validServers > 0 && !status.lastError ? 'healthy' :
      status.status === 'running' && status.validServers > 0 ? 'running_with_issues' :
      'unhealthy'
    
    // Generate recommendations based on status
    const recommendations: string[] = []
    if (status.status === 'stopped') {
      recommendations.push('MCPO is not running. Call POST /api/mcpo/restart to start it.')
    }
    if (status.validServers === 0) {
      recommendations.push('No valid servers found. Check your server configurations.')
    }
    if (status.invalidServers > 0) {
      recommendations.push(`${status.invalidServers} invalid servers found. Check server settings.`)
    }
    if (status.lastError) {
      recommendations.push('Resolve the last error shown in the error details.')
    }
    if (status.restartCount > 5) {
      recommendations.push('High restart count detected. Check for configuration issues.')
    }
    if (healthStatus === 'healthy') {
      recommendations.push('All systems operating normally.')
    }
    
    return NextResponse.json({
      healthStatus,
      timestamp: new Date().toISOString(),
      process: {
        status: status.status,
        processId: status.processId,
        uptime: status.uptime,
        restartCount: status.restartCount,
        lastRestart: status.lastRestart,
        configFile: status.configFile,
        mcpoUrl: status.mcpoUrl
      },
      servers: {
        totalValid: status.validServers,
        totalInvalid: status.invalidServers,
        validServersList: mcpoManager.getValidServers(),
        invalidServersDetails: mcpoManager.getInvalidServers()
      },
      errors: {
        lastError: status.lastError,
        hasErrors: !!status.lastError
      },
      monitoring: {
        recentLogs: status.recentLogs.slice(-10), // Last 10 log entries
        statusHistory: status.statusHistory.slice(-5) // Last 5 status changes
      },
      recommendations
    })
    
  } catch (error) {
    console.error('Error getting MCPO status:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json(
      {
        healthStatus: 'unhealthy',
        error: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
})