import { MCPService } from "@/lib/mcp-service"
import ServersList from "@/components/servers-list"

// Server Component: reads MCP servers from database
async function loadConfig() {
  try {
    return await MCPService.getAllServers()
  } catch (error) {
    console.error('Error loading MCP servers:', error)
    return { mcpServers: {} }
  }
}

async function loadServersWithMetadata() {
  try {
    return await MCPService.getAllServersWithMetadata()
  } catch (error) {
    console.error('Error loading MCP servers with metadata:', error)
    return []
  }
}

export default async function Page() {
  const config = await loadConfig()
  const servers = await loadServersWithMetadata()

  return <ServersList initialConfig={config} servers={servers} />
}
