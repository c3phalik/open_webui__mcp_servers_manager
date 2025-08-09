import { prisma } from './prisma'
import { MCPServerType, RemoteServerType } from '@prisma/client'
import { generateUniqueId } from './slug-utils'

// Dynamic import to avoid circular dependency
const getMCPOManager = async () => {
  const { default: mcpoManager } = await import('./mcpo-manager')
  return mcpoManager
}

export type MCPServerConfig = 
  | {
      command: "npx" | "uvx" | "npm"
      args: string[]
    }
  | {
      type: 'sse' | 'streamable-http'
      url: string
      headers?: Record<string, string>
    }

export interface MCPServer {
  id: string
  name: string
  uniqueId: string
  shareWithWorkspace: boolean
  config: MCPServerConfig
}

export interface MCPServersConfig {
  mcpServers: Record<string, MCPServerConfig>
}

export class MCPService {
  // Helper method to restart MCPO after database changes
  private static async restartMCPO() {
    try {
      const mcpoManager = await getMCPOManager()
      // Fire and forget - don't wait for restart to complete
      mcpoManager.restart().catch(error => {
        console.error('Failed to restart MCPO after database change:', error)
      })
    } catch (error) {
      console.error('Failed to get MCPO manager for restart:', error)
    }
  }
  static async getAllServers(): Promise<MCPServersConfig> {
    const servers = await prisma.mcpServer.findMany({
      where: { enabled: true },
      orderBy: { name: 'asc' }
    })

    const mcpServers: Record<string, MCPServerConfig> = {}

    for (const server of servers) {
      if (server.type === MCPServerType.Local) {
        mcpServers[server.mcpServerUniqueId] = {
          command: server.command as "npx" | "uvx" | "npm",
          args: (server.args as string[]) || []
        }
      } else if (server.type === MCPServerType.Remote) {
        mcpServers[server.mcpServerUniqueId] = {
          type: server.remoteServerType === RemoteServerType.sse ? 'sse' : 'streamable-http',
          url: server.url!,
          ...(server.headers ? { headers: server.headers as Record<string, string> } : {})
        }
      }
    }

    return { mcpServers }
  }

  static async getAllServersWithMetadata(): Promise<MCPServer[]> {
    const servers = await prisma.mcpServer.findMany({
      where: { enabled: true },
      orderBy: { name: 'asc' }
    })

    return servers.map(server => ({
      id: server.id,
      name: server.name,
      uniqueId: server.mcpServerUniqueId,
      shareWithWorkspace: server.shareWithWorkspace,
      config: server.type === MCPServerType.Local
        ? {
            command: server.command as "npx" | "uvx" | "npm",
            args: (server.args as string[]) || []
          }
        : {
            type: server.remoteServerType === RemoteServerType.sse ? 'sse' : 'streamable-http',
            url: server.url!,
            ...(server.headers ? { headers: server.headers as Record<string, string> } : {})
          }
    }))
  }

  static async getServerByName(name: string) {
    return await prisma.mcpServer.findUnique({
      where: { name }
    })
  }

  static async getServerByUniqueId(uniqueId: string): Promise<MCPServer | null> {
    const server = await prisma.mcpServer.findUnique({
      where: { mcpServerUniqueId: uniqueId }
    })

    if (!server) {
      return null
    }

    return {
      id: server.id,
      name: server.name,
      uniqueId: server.mcpServerUniqueId,
      shareWithWorkspace: server.shareWithWorkspace,
      config: server.type === MCPServerType.Local
        ? {
            command: server.command as "npx" | "uvx" | "npm",
            args: (server.args as string[]) || []
          }
        : {
            type: server.remoteServerType === RemoteServerType.sse ? 'sse' : 'streamable-http',
            url: server.url!,
            ...(server.headers ? { headers: server.headers as Record<string, string> } : {})
          }
    }
  }

  static async createServer(
    name: string, 
    config: MCPServerConfig, 
    shareWithWorkspace: boolean = false
  ): Promise<MCPServer> {
    const isLocal = 'command' in config
    
    const server = await prisma.mcpServer.create({
      data: {
        name,
        mcpServerUniqueId: '', // Will be updated after creation
        type: isLocal ? MCPServerType.Local : MCPServerType.Remote,
        command: isLocal ? config.command : null,
        args: isLocal ? config.args : undefined,
        remoteServerType: !isLocal ? (
          config.type === 'sse' 
            ? RemoteServerType.sse 
            : RemoteServerType.streamable_http
        ) : null,
        url: !isLocal ? config.url : null,
        headers: !isLocal ? config.headers : undefined,
        shareWithWorkspace
      }
    })

    // Generate and update unique ID using the created server's UUID
    const uniqueId = generateUniqueId(name, server.id)
    const updatedServer = await prisma.mcpServer.update({
      where: { id: server.id },
      data: { mcpServerUniqueId: uniqueId }
    })

    // Restart MCPO after creating server
    this.restartMCPO()

    return {
      id: updatedServer.id,
      name: updatedServer.name,
      uniqueId: updatedServer.mcpServerUniqueId,
      shareWithWorkspace: updatedServer.shareWithWorkspace,
      config
    }
  }

  static async updateServer(
    uniqueId: string, 
    name: string, 
    config: MCPServerConfig, 
    shareWithWorkspace: boolean = false
  ): Promise<MCPServer> {
    const isLocal = 'command' in config
    
    // Get the current server to check if name changed
    const currentServer = await prisma.mcpServer.findUnique({
      where: { mcpServerUniqueId: uniqueId }
    })

    if (!currentServer) {
      throw new Error('Server not found')
    }

    let newUniqueId = uniqueId
    // If name changed, generate new unique ID
    if (currentServer.name !== name) {
      newUniqueId = generateUniqueId(name, currentServer.id)
    }
    
    const updatedServer = await prisma.mcpServer.update({
      where: { mcpServerUniqueId: uniqueId },
      data: {
        name,
        mcpServerUniqueId: newUniqueId,
        type: isLocal ? MCPServerType.Local : MCPServerType.Remote,
        command: isLocal ? config.command : null,
        args: isLocal ? config.args : undefined,
        remoteServerType: !isLocal ? (
          config.type === 'sse' 
            ? RemoteServerType.sse 
            : RemoteServerType.streamable_http
        ) : null,
        url: !isLocal ? config.url : null,
        headers: !isLocal ? config.headers : undefined,
        shareWithWorkspace
      }
    })

    // Restart MCPO after updating server
    this.restartMCPO()

    return {
      id: updatedServer.id,
      name: updatedServer.name,
      uniqueId: updatedServer.mcpServerUniqueId,
      shareWithWorkspace: updatedServer.shareWithWorkspace,
      config
    }
  }

  static async deleteServer(uniqueId: string) {
    const result = await prisma.mcpServer.delete({
      where: { mcpServerUniqueId: uniqueId }
    })

    // Restart MCPO after deleting server
    this.restartMCPO()

    return result
  }

  static async deleteServerByName(name: string) {
    const result = await prisma.mcpServer.delete({
      where: { name }
    })

    // Restart MCPO after deleting server
    this.restartMCPO()

    return result
  }

  static async replaceAllServers(config: MCPServersConfig) {
    await prisma.$transaction(async (tx) => {
      await tx.mcpServer.deleteMany()
      
      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        const isLocal = 'command' in serverConfig
        
        const server = await tx.mcpServer.create({
          data: {
            name,
            mcpServerUniqueId: '', // Will be updated
            type: isLocal ? MCPServerType.Local : MCPServerType.Remote,
            command: isLocal ? serverConfig.command : null,
            args: isLocal ? serverConfig.args : undefined,
            remoteServerType: !isLocal ? (
              serverConfig.type === 'sse' 
                ? RemoteServerType.sse 
                : RemoteServerType.streamable_http
            ) : null,
            url: !isLocal ? serverConfig.url : null,
            headers: !isLocal ? serverConfig.headers : undefined
          }
        })

        // Update with generated unique ID
        const uniqueId = generateUniqueId(name, server.id)
        await tx.mcpServer.update({
          where: { id: server.id },
          data: { mcpServerUniqueId: uniqueId }
        })
      }
    })

    // Restart MCPO after replacing all servers
    this.restartMCPO()
  }
}