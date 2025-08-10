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
  userId: string
  config: MCPServerConfig
}

export interface MCPServersConfig {
  mcpServers: Record<string, MCPServerConfig>
}

export interface UserContext {
  userId: string
  isAdmin: boolean
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
  // Get authorization filter based on user context
  private static getAuthorizationFilter(userContext?: UserContext) {
    if (!userContext) {
      // No user context - return only shared servers (for backward compatibility)
      return { 
        enabled: true,
        shareWithWorkspace: true
      }
    }

    if (userContext.isAdmin) {
      // Admin can see all servers
      return { enabled: true }
    }

    // Regular users see their own servers + shared servers
    return {
      enabled: true,
      OR: [
        { userId: userContext.userId },
        { shareWithWorkspace: true }
      ]
    }
  }

  // Admin methods for MCPO operations - bypass user filtering to get ALL servers
  static async getAllServersForAdmin(): Promise<MCPServersConfig> {
    const servers = await prisma.mcpServer.findMany({
      where: { enabled: true }, // Only filter by enabled status
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

  static async getAllServersWithMetadataForAdmin(): Promise<MCPServer[]> {
    const servers = await prisma.mcpServer.findMany({
      where: { enabled: true }, // Only filter by enabled status
      orderBy: { name: 'asc' },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    return servers.map(server => ({
      id: server.id,
      name: server.name,
      uniqueId: server.mcpServerUniqueId,
      shareWithWorkspace: server.shareWithWorkspace,
      userId: server.userId,
      config: server.type === MCPServerType.Local ? {
        command: server.command as "npx" | "uvx" | "npm",
        args: (server.args as string[]) || []
      } : {
        type: server.remoteServerType === RemoteServerType.sse ? 'sse' : 'streamable-http',
        url: server.url!,
        ...(server.headers ? { headers: server.headers as Record<string, string> } : {})
      }
    }))
  }

  static async getAllServers(userContext?: UserContext): Promise<MCPServersConfig> {
    const servers = await prisma.mcpServer.findMany({
      where: this.getAuthorizationFilter(userContext),
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

  static async getAllServersWithMetadata(userContext?: UserContext): Promise<MCPServer[]> {
    const servers = await prisma.mcpServer.findMany({
      where: this.getAuthorizationFilter(userContext),
      orderBy: { name: 'asc' },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    return servers.map(server => ({
      id: server.id,
      name: server.name,
      uniqueId: server.mcpServerUniqueId,
      shareWithWorkspace: server.shareWithWorkspace,
      userId: server.userId,
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

  static async getServerByName(name: string, userContext?: UserContext) {
    return await prisma.mcpServer.findFirst({
      where: { 
        name,
        ...this.getAuthorizationFilter(userContext)
      }
    })
  }

  static async getServerById(id: string, userContext?: UserContext) {
    return await prisma.mcpServer.findFirst({
      where: { 
        id,
        ...this.getAuthorizationFilter(userContext)
      }
    })
  }

  static async canUserModifyServer(serverId: string, userContext: UserContext): Promise<boolean> {
    if (userContext.isAdmin) {
      return true
    }

    const server = await prisma.mcpServer.findUnique({
      where: { id: serverId },
      select: { userId: true }
    })

    return server?.userId === userContext.userId
  }


  static async updateServerWithMetadata(id: string, data: { name?: string; uniqueId?: string; shareWithWorkspace?: boolean; config?: Record<string, unknown> }, userContext: UserContext) {
    // Check if user can modify this server
    const canModify = await this.canUserModifyServer(id, userContext)
    if (!canModify) {
      throw new Error("Access denied: You can only modify your own servers")
    }

    const server = await prisma.mcpServer.update({
      where: { id },
      data
    })

    // Restart MCPO after updating server
    await this.restartMCPO()

    return server
  }

  static async deleteServerWithAuth(id: string, userContext: UserContext) {
    // Check if user can modify this server
    const canModify = await this.canUserModifyServer(id, userContext)
    if (!canModify) {
      throw new Error("Access denied: You can only delete your own servers")
    }

    const server = await prisma.mcpServer.delete({
      where: { id }
    })

    // Restart MCPO after deleting server
    await this.restartMCPO()

    return server
  }

  static async getServerByUniqueId(uniqueId: string, userContext?: UserContext): Promise<MCPServer | null> {
    const server = await prisma.mcpServer.findFirst({
      where: { 
        mcpServerUniqueId: uniqueId,
        ...this.getAuthorizationFilter(userContext)
      }
    })

    if (!server) {
      return null
    }

    return {
      id: server.id,
      name: server.name,
      uniqueId: server.mcpServerUniqueId,
      shareWithWorkspace: server.shareWithWorkspace,
      userId: server.userId,
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

  // Legacy method - redirects to new method with user context
  static async createServer(
    name: string, 
    config: MCPServerConfig, 
    shareWithWorkspace: boolean = false,
    userContext?: UserContext
  ): Promise<MCPServer> {
    if (!userContext) {
      throw new Error("User context is required for creating servers")
    }
    
    const isLocal = 'command' in config
    
    const server = await prisma.mcpServer.create({
      data: {
        name,
        mcpServerUniqueId: '', // Will be updated after creation
        type: isLocal ? MCPServerType.Local : MCPServerType.Remote,
        userId: userContext.userId, // Add user ownership
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
      userId: updatedServer.userId,
      config
    }
  }

  // Legacy method - redirects to new method with user context
  static async updateServer(
    uniqueId: string, 
    name: string, 
    config: MCPServerConfig, 
    shareWithWorkspace: boolean = false,
    userContext?: UserContext
  ): Promise<MCPServer> {
    if (!userContext) {
      throw new Error("User context is required for updating servers")
    }

    const isLocal = 'command' in config
    
    // Get the current server to check if name changed and validate ownership
    const currentServer = await prisma.mcpServer.findUnique({
      where: { mcpServerUniqueId: uniqueId }
    })

    if (!currentServer) {
      throw new Error('Server not found')
    }

    // Check if user can modify this server
    if (!userContext.isAdmin && currentServer.userId !== userContext.userId) {
      throw new Error("Access denied: You can only modify your own servers")
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
      userId: updatedServer.userId,
      config
    }
  }

  // Legacy method - redirects to new method with user context
  static async deleteServer(uniqueId: string, userContext?: UserContext) {
    if (!userContext) {
      throw new Error("User context is required for deleting servers")
    }

    // Get the current server to validate ownership
    const currentServer = await prisma.mcpServer.findUnique({
      where: { mcpServerUniqueId: uniqueId }
    })

    if (!currentServer) {
      throw new Error('Server not found')
    }

    // Check if user can modify this server
    if (!userContext.isAdmin && currentServer.userId !== userContext.userId) {
      throw new Error("Access denied: You can only delete your own servers")
    }

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
            userId: '', // Legacy function - userId should be provided
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