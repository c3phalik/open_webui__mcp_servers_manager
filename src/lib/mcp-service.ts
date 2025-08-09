import { prisma } from './prisma'
import { MCPServerType, RemoteServerType } from '@prisma/client'
import { generateUniqueId } from './slug-utils'

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
  static async getAllServers(): Promise<MCPServersConfig> {
    const servers = await prisma.mcpServer.findMany({
      where: { enabled: true },
      orderBy: { name: 'asc' }
    })

    const mcpServers: Record<string, MCPServerConfig> = {}

    for (const server of servers) {
      if (server.type === MCPServerType.Local) {
        mcpServers[server.name] = {
          command: server.command as "npx" | "uvx" | "npm",
          args: (server.args as string[]) || []
        }
      } else if (server.type === MCPServerType.Remote) {
        mcpServers[server.name] = {
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

    return {
      id: updatedServer.id,
      name: updatedServer.name,
      uniqueId: updatedServer.mcpServerUniqueId,
      shareWithWorkspace: updatedServer.shareWithWorkspace,
      config
    }
  }

  static async deleteServer(uniqueId: string) {
    return await prisma.mcpServer.delete({
      where: { mcpServerUniqueId: uniqueId }
    })
  }

  static async deleteServerByName(name: string) {
    return await prisma.mcpServer.delete({
      where: { name }
    })
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
  }
}