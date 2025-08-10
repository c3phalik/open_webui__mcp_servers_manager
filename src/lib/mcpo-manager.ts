import { ChildProcess, spawn } from 'child_process'
import { EventEmitter } from 'events'
import * as fs from 'fs/promises'
import * as path from 'path'
import { MCPService } from './mcp-service'
// Using native fetch (available in Node.js 18+)

export type MCPOStatus = 'starting' | 'running' | 'stopped' | 'error' | 'restarting' | 'stopping'

export interface StatusChange {
  status: MCPOStatus
  timestamp: Date
  message?: string
}

export interface ValidationResult {
  valid: boolean
  errors: Array<{ server: string; error: string }>
  validServers: string[]
  invalidServers: string[]
}

export interface MCPOMonitorData {
  status: MCPOStatus
  uptime: number // seconds
  processId: number | null
  lastRestart: Date | null
  restartCount: number
  validServers: number
  invalidServers: number
  recentLogs: string[]
  statusHistory: StatusChange[]
  mcpoUrl: string
  configFile: string | null
  lastError: string | null
}

class CircularBuffer<T> {
  private buffer: T[] = []
  private maxSize: number

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize
  }

  push(item: T): void {
    this.buffer.push(item)
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift()
    }
  }

  getAll(): T[] {
    return [...this.buffer]
  }

  getLast(n: number): T[] {
    return this.buffer.slice(-n)
  }

  clear(): void {
    this.buffer = []
  }
}

class MCPOManager {
  private static instance: MCPOManager
  private process: ChildProcess | null = null
  private status: MCPOStatus = 'stopped'
  private logs: CircularBuffer<string> = new CircularBuffer(1000)
  private statusHistory: CircularBuffer<StatusChange> = new CircularBuffer(100)
  private eventEmitter: EventEmitter = new EventEmitter()
  private startTime: Date | null = null
  private lastRestart: Date | null = null
  private restartCount: number = 0
  private configFile: string | null = null
  private lastError: string | null = null
  private validServers: string[] = []
  private invalidServers: { [key: string]: string } = {}
  private isShuttingDown: boolean = false

  private constructor() {
    // Private constructor for singleton pattern
  }

  static getInstance(): MCPOManager {
    if (!MCPOManager.instance) {
      MCPOManager.instance = new MCPOManager()
    }
    return MCPOManager.instance
  }

  // Core process management methods
  async start(): Promise<void> {
    if (this.process && this.status === 'running') {
      this.log('MCPO is already running')
      return
    }

    try {
      this.setStatus('starting', 'Initializing MCPO...')
      
      // Generate and validate configuration
      const configPath = await this.generateConfig()
      if (!configPath) {
        throw new Error('Failed to generate configuration')
      }

      // Get MCPO API key from environment
      const mcpoApiKey = process.env.MCPO_API_KEY
      if (!mcpoApiKey) {
        throw new Error('MCPO_API_KEY not found in environment')
      }

      // Prepare MCPO command
      const command = 'uvx'
      const args = [
        'mcpo',
        '--config', configPath,
        '--api-key', mcpoApiKey,
        '--port', this.getMcpoPort(),
      ]

      this.log(`Starting MCPO: ${command} ${args.join(' ')}`)

      // Spawn MCPO process
      this.process = spawn(command, args, {
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe']
      })

      if (!this.process.pid) {
        throw new Error('Failed to start MCPO process')
      }

      // Set up process event handlers
      this.setupProcessHandlers()

      // Wait a moment to check if process starts successfully
      await new Promise(resolve => setTimeout(resolve, 2000))

      if (this.process.exitCode !== null) {
        throw new Error(`MCPO exited immediately with code ${this.process.exitCode}`)
      }

      this.startTime = new Date()
      this.setStatus('running', `MCPO started with PID ${this.process.pid}`)
      this.log(`MCPO is running on http://localhost:${this.getMcpoPort()}`)

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.lastError = errorMsg
      this.setStatus('error', `Failed to start MCPO: ${errorMsg}`)
      throw error
    }
  }

  async stop(): Promise<void> {
    if (!this.process || this.status === 'stopped') {
      this.log('MCPO is not running')
      return
    }

    try {
      this.isShuttingDown = true
      this.setStatus('stopping', 'Shutting down MCPO...')

      // Try graceful shutdown first
      this.process.kill('SIGTERM')

      // Wait up to 10 seconds for graceful shutdown
      const timeout = 10000
      const startTime = Date.now()
      
      while (this.process.exitCode === null && Date.now() - startTime < timeout) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Force kill if still running
      if (this.process.exitCode === null) {
        this.log('MCPO did not stop gracefully, force killing...')
        this.process.kill('SIGKILL')
      }

      this.process = null
      this.startTime = null
      this.setStatus('stopped', 'MCPO stopped')
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.lastError = errorMsg
      this.setStatus('error', `Failed to stop MCPO: ${errorMsg}`)
      throw error
    } finally {
      this.isShuttingDown = false
    }
  }

  async restart(): Promise<void> {
    this.setStatus('restarting', 'Restarting MCPO...')
    this.restartCount++
    this.lastRestart = new Date()
    
    await this.stop()
    await this.start()
  }

  // Configuration management (public method)
  async generateConfig(): Promise<string | null> {
    try {
      // Get ALL servers from database (admin operation - no user filtering)
      const servers = await MCPService.getAllServersWithMetadataForAdmin()
      
      // Validate servers
      const validation = await this.validateServers(servers)
      this.validServers = validation.validServers
      
      // Store invalid servers for reporting
      this.invalidServers = {}
      validation.errors.forEach(err => {
        this.invalidServers[err.server] = err.error
      })

      if (validation.validServers.length === 0) {
        throw new Error('No valid servers found in configuration')
      }

      // Generate config only with valid servers using admin method (all servers)
      const config = await MCPService.getAllServersForAdmin()
      this.log(`Raw config keys: [${Object.keys(config.mcpServers).join(', ')}]`)
      this.log(`Valid server keys: [${validation.validServers.join(', ')}]`)
      
      // Filter out invalid servers from config
      const filteredConfig = {
        mcpServers: Object.fromEntries(
          Object.entries(config.mcpServers).filter(([key]) => 
            validation.validServers.includes(key)
          )
        )
      }
      
      this.log(`Filtered config keys: [${Object.keys(filteredConfig.mcpServers).join(', ')}]`)

      // Write config to temporary file
      const tmpDir = path.join(process.cwd(), '.tmp')
      await fs.mkdir(tmpDir, { recursive: true })
      
      // Clean up old config files first
      await this.cleanupOldConfigFiles(tmpDir)
      
      const configPath = path.join(tmpDir, `mcpo_config_${Date.now()}.json`)
      await fs.writeFile(configPath, JSON.stringify(filteredConfig, null, 2))
      
      // Clean up old config file
      if (this.configFile && this.configFile !== configPath) {
        try {
          await fs.unlink(this.configFile)
        } catch (err) {
          // Ignore error if file doesn't exist
        }
      }
      
      this.configFile = configPath
      this.log(`Generated config with ${validation.validServers.length} valid servers: ${configPath}`)
      
      return configPath
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.log(`Failed to generate config: ${errorMsg}`)
      this.lastError = errorMsg
      return null
    }
  }

  async validateServers(servers: Array<{ uniqueId?: string; name: string; config: Record<string, unknown> }>): Promise<ValidationResult> {
    const errors: Array<{ server: string; error: string }> = []
    const validServers: string[] = []
    const invalidServers: string[] = []

    this.log(`Validating ${servers.length} servers from database`)
    
    for (const server of servers) {
      const serverName = server.uniqueId || server.name
      this.log(`Validating server: ${serverName} (uniqueId: ${server.uniqueId}, name: ${server.name})`)
      
      try {
        // Validate based on server type
        if ('command' in server.config) {
          // Local server validation
          const { command, args } = server.config
          
          // Basic validation for local servers
          if (!command) {
            errors.push({ server: serverName, error: 'Missing command' })
            invalidServers.push(serverName)
            continue
          }
          
          if (!Array.isArray(args)) {
            errors.push({ server: serverName, error: 'Args must be an array' })
            invalidServers.push(serverName)
            continue
          }
          
          validServers.push(serverName)
          
        } else if ('type' in server.config && 'url' in server.config) {
          // Remote server validation
          const { type, url } = server.config
          
          if (typeof type !== 'string' || !['sse', 'streamable-http'].includes(type)) {
            errors.push({ server: serverName, error: `Invalid type: ${type}` })
            invalidServers.push(serverName)
            continue
          }
          
          if (typeof url !== 'string' || !url || !url.startsWith('http')) {
            errors.push({ server: serverName, error: `Invalid URL: ${url}` })
            invalidServers.push(serverName)
            continue
          }
          
          // Optional: Test URL connectivity (commented out for speed)
          // try {
          //   const response = await fetch(url, { 
          //     method: 'HEAD', 
          //     timeout: 5000 
          //   })
          //   if (response.status >= 500) {
          //     errors.push({ server: serverName, error: `Server error: ${response.status}` })
          //     invalidServers.push(serverName)
          //     continue
          //   }
          // } catch (err) {
          //   errors.push({ server: serverName, error: `Cannot reach URL: ${err.message}` })
          //   invalidServers.push(serverName)
          //   continue
          // }
          
          validServers.push(serverName)
          
        } else {
          errors.push({ server: serverName, error: 'Invalid server configuration' })
          invalidServers.push(serverName)
        }
        
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        errors.push({ server: serverName, error: errorMsg })
        invalidServers.push(serverName)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      validServers,
      invalidServers
    }
  }

  // Process event handlers
  private setupProcessHandlers(): void {
    if (!this.process) return

    // Handle stdout
    this.process.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(line => line.trim())
      lines.forEach(line => {
        this.log(`MCPO: ${line}`)
      })
    })

    // Handle stderr
    this.process.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(line => line.trim())
      lines.forEach(line => {
        this.log(`MCPO ERROR: ${line}`, 'error')
      })
    })

    // Handle process exit
    this.process.on('exit', (code, signal) => {
      this.log(`MCPO exited with code ${code} and signal ${signal}`)
      
      if (!this.isShuttingDown) {
        // Unexpected exit
        this.lastError = `Process exited unexpectedly with code ${code}`
        this.setStatus('error', this.lastError)
        
        // Auto-restart logic (with backoff)
        if (this.restartCount < 3) {
          setTimeout(() => {
            this.log('Attempting auto-restart...')
            this.restart().catch(err => {
              this.log(`Auto-restart failed: ${err}`, 'error')
            })
          }, 5000 * (this.restartCount + 1))
        }
      }
    })

    // Handle process errors
    this.process.on('error', (error) => {
      this.lastError = error.message
      this.log(`MCPO process error: ${error.message}`, 'error')
      this.setStatus('error', `Process error: ${error.message}`)
    })
  }

  // Monitoring methods
  getStatus(): MCPOMonitorData {
    const uptime = this.startTime 
      ? Math.floor((Date.now() - this.startTime.getTime()) / 1000)
      : 0

    return {
      status: this.status,
      uptime,
      processId: this.process?.pid || null,
      lastRestart: this.lastRestart,
      restartCount: this.restartCount,
      validServers: this.validServers.length,
      invalidServers: Object.keys(this.invalidServers).length,
      recentLogs: this.logs.getLast(50),
      statusHistory: this.statusHistory.getLast(20),
      mcpoUrl: this.status === 'running' ? `http://localhost:${this.getMcpoPort()}` : '',
      configFile: this.configFile,
      lastError: this.lastError
    }
  }

  getLogs(limit: number = 100): string[] {
    return this.logs.getLast(limit)
  }

  getStatusHistory(): StatusChange[] {
    return this.statusHistory.getAll()
  }

  getValidServers(): string[] {
    return this.validServers
  }

  getInvalidServers(): { [key: string]: string } {
    return this.invalidServers
  }

  // Event handling
  onStatusChange(callback: (status: StatusChange) => void): void {
    this.eventEmitter.on('statusChange', callback)
  }

  offStatusChange(callback: (status: StatusChange) => void): void {
    this.eventEmitter.off('statusChange', callback)
  }

  // Private helper methods
  private setStatus(status: MCPOStatus, message?: string): void {
    this.status = status
    const change: StatusChange = {
      status,
      timestamp: new Date(),
      message
    }
    this.statusHistory.push(change)
    this.eventEmitter.emit('statusChange', change)
    this.log(`Status changed to: ${status}${message ? ` - ${message}` : ''}`)
  }

  private log(message: string, level: 'info' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] ${message}`
    this.logs.push(logMessage)
    
    if (level === 'error') {
      console.error(logMessage)
    } else {
      console.log(logMessage)
    }
  }

  // Cleanup old config files
  private async cleanupOldConfigFiles(tmpDir: string): Promise<void> {
    try {
      this.log(`Starting cleanup of old config files in ${tmpDir}`)
      const files = await fs.readdir(tmpDir)
      const configFiles = files.filter(file => file.startsWith('mcpo_config_') && file.endsWith('.json'))
      this.log(`Found ${configFiles.length} config files: [${configFiles.join(', ')}]`)
      
      // Keep only the 3 most recent files, delete the rest
      if (configFiles.length > 3) {
        const sortedFiles = configFiles
          .map(file => ({
            name: file,
            path: path.join(tmpDir, file),
            timestamp: parseInt(file.match(/mcpo_config_(\d+)\.json/)?.[1] || '0')
          }))
          .sort((a, b) => b.timestamp - a.timestamp) // Sort by newest first
        
        const filesToDelete = sortedFiles.slice(3) // Keep first 3, delete the rest
        this.log(`Will delete ${filesToDelete.length} old files: [${filesToDelete.map(f => f.name).join(', ')}]`)
        
        for (const file of filesToDelete) {
          try {
            await fs.unlink(file.path)
            this.log(`Successfully deleted old config file: ${file.name}`)
          } catch (err) {
            this.log(`Failed to delete ${file.name}: ${err}`, 'error')
          }
        }
      } else {
        this.log(`Only ${configFiles.length} config files found, no cleanup needed`)
      }
    } catch (err) {
      this.log(`Warning: Could not cleanup old config files: ${err}`, 'error')
    }
  }

  // Get MCPO port from environment with validation
  private getMcpoPort(): string {
    const port = process.env.NEXT_PUBLIC_MCPO_PORT
    if (!port) {
      throw new Error('NEXT_PUBLIC_MCPO_PORT environment variable is required but not set. Please set NEXT_PUBLIC_MCPO_PORT in your environment (e.g., NEXT_PUBLIC_MCPO_PORT=8000)')
    }
    return port
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    await this.stop()
    if (this.configFile) {
      try {
        await fs.unlink(this.configFile)
      } catch (err) {
        // Ignore error
      }
    }
  }
}

export default MCPOManager.getInstance()