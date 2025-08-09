const { MCPService } = require('../src/lib/mcp-service.ts')

async function testService() {
  try {
    console.log('🧪 Testing MCPService.getAllServersWithMetadata()...')
    const servers = await MCPService.getAllServersWithMetadata()
    console.log(`✅ Found ${servers.length} servers:`)
    
    servers.forEach(server => {
      console.log(`  - ${server.name} (${server.uniqueId}) - Shared: ${server.shareWithWorkspace}`)
    })
    
    console.log('\n🧪 Testing MCPService.getAllServers()...')
    const config = await MCPService.getAllServers()
    console.log(`✅ Found ${Object.keys(config.mcpServers).length} servers in config format`)
    
  } catch (error) {
    console.error('❌ Error testing service:', error)
  }
}

testService()