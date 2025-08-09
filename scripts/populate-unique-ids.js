const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')

// Import our slug utility functions
function createUrlSlug(name) {
  if (!name || typeof name !== 'string') {
    return 'unnamed'
  }

  return name
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'unnamed'
}

function generateUniqueId(name, uuid) {
  const slug = createUrlSlug(name)
  const shortUuid = uuid ? uuid.substring(0, 8) : crypto.randomUUID().substring(0, 8)
  return `${slug}-${shortUuid}`
}

async function populateUniqueIds() {
  const prisma = new PrismaClient()
  
  try {
    console.log('🔄 Finding servers with missing unique IDs...')
    
    const serversWithoutUniqueId = await prisma.mcpServer.findMany({
      where: {
        mcpServerUniqueId: null
      }
    })
    
    console.log(`📋 Found ${serversWithoutUniqueId.length} servers without unique IDs`)
    
    for (const server of serversWithoutUniqueId) {
      const uniqueId = generateUniqueId(server.name, server.id)
      console.log(`  📝 Updating "${server.name}" -> "${uniqueId}"`)
      
      await prisma.mcpServer.update({
        where: { id: server.id },
        data: { mcpServerUniqueId: uniqueId }
      })
    }
    
    console.log('✅ All servers now have unique IDs!')
    
    // Verify the results
    const allServers = await prisma.mcpServer.findMany({
      select: { name: true, mcpServerUniqueId: true }
    })
    
    console.log('\n📊 Current servers:')
    allServers.forEach(server => {
      console.log(`  - ${server.name} -> ${server.mcpServerUniqueId}`)
    })
    
  } catch (error) {
    console.error('❌ Error populating unique IDs:', error)
  } finally {
    await prisma.$disconnect()
  }
}

populateUniqueIds()