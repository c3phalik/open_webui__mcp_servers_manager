import { NextResponse } from 'next/server'
import { adminMiddleware } from '@/lib/auth-middleware'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Function to get ports for a specific PID
async function getPortsForPid(pid: number): Promise<number[]> {
  try {
    // Use lsof to find listening ports for the process
    const { stdout } = await execAsync(`lsof -Pan -p ${pid} -i 2>/dev/null || true`)
    
    const ports: number[] = []
    if (stdout.trim()) {
      const lines = stdout.trim().split('\n')
      for (const line of lines) {
        // Look for TCP or UDP connections with LISTEN state
        if (line.includes('LISTEN') || line.includes('UDP')) {
          const match = line.match(/:(\d+)\s/)
          if (match) {
            const port = parseInt(match[1])
            if (!isNaN(port) && !ports.includes(port)) {
              ports.push(port)
            }
          }
        }
      }
    }
    
    return ports.sort((a, b) => a - b)
  } catch (error) {
    // If lsof fails, try netstat as fallback
    try {
      const { stdout } = await execAsync(`netstat -tlnp 2>/dev/null | grep "${pid}/" || true`)
      
      const ports: number[] = []
      if (stdout.trim()) {
        const lines = stdout.trim().split('\n')
        for (const line of lines) {
          const match = line.match(/:(\d+)\s/)
          if (match) {
            const port = parseInt(match[1])
            if (!isNaN(port) && !ports.includes(port)) {
              ports.push(port)
            }
          }
        }
      }
      
      return ports.sort((a, b) => a - b)
    } catch (fallbackError) {
      console.warn(`Could not determine ports for PID ${pid}:`, fallbackError)
      return []
    }
  }
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

export const GET = adminMiddleware(async () => {
  try {
    // Execute ps aux command to get all processes, then filter for mcpo
    const { stdout, stderr } = await execAsync('ps aux | grep mcpo | grep -v grep')
    
    if (stderr) {
      console.warn('ps aux stderr:', stderr)
    }

    const processes: ProcessInfo[] = []
    
    if (stdout.trim()) {
      const lines = stdout.trim().split('\n')
      
      // Parse process info first
      const tempProcesses = []
      for (const line of lines) {
        // Parse ps aux output format:
        // USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
        const parts = line.trim().split(/\s+/)
        
        if (parts.length >= 11) {
          const process = {
            user: parts[0],
            pid: parseInt(parts[1]),
            cpu: parseFloat(parts[2]),
            memory: parseFloat(parts[3]),
            vsz: parseInt(parts[4]),
            rss: parseInt(parts[5]),
            tty: parts[6],
            stat: parts[7],
            start: parts[8],
            time: parts[9],
            command: parts.slice(10).join(' ')
          }
          
          // Only include if PID is valid
          if (!isNaN(process.pid)) {
            tempProcesses.push(process)
          }
        }
      }

      // Now get ports for each process (in parallel for better performance)
      const processPromises = tempProcesses.map(async (process) => {
        const ports = await getPortsForPid(process.pid)
        return {
          ...process,
          ports
        } as ProcessInfo
      })

      const processesWithPorts = await Promise.all(processPromises)
      processes.push(...processesWithPorts)
    }

    // Calculate summary statistics
    const allPorts = processes.flatMap(p => p.ports)
    const uniquePorts = [...new Set(allPorts)].sort((a, b) => a - b)
    
    const summary = {
      totalProcesses: processes.length,
      totalCpu: processes.reduce((sum, p) => sum + p.cpu, 0),
      totalMemory: processes.reduce((sum, p) => sum + p.memory, 0),
      totalRss: processes.reduce((sum, p) => sum + p.rss, 0),
      pids: processes.map(p => p.pid),
      ports: uniquePorts,
      totalPorts: uniquePorts.length
    }

    return NextResponse.json({
      success: true,
      processes,
      summary,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Error fetching process data:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        message: 'Failed to fetch process data',
        processes: [],
        summary: {
          totalProcesses: 0,
          totalCpu: 0,
          totalMemory: 0,
          totalRss: 0,
          pids: [],
          ports: [],
          totalPorts: 0
        }
      },
      { status: 500 }
    )
  }
})