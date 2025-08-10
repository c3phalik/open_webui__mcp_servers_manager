import { prisma } from './prisma'

/**
 * Ensure the first user in the system becomes an admin
 */
export async function ensureFirstUserIsAdmin() {
  try {
    const userCount = await prisma.user.count()
    
    if (userCount === 1) {
      // Get the first (and only) user
      const firstUser = await prisma.user.findFirst()
      
      if (firstUser && firstUser.role !== 'admin') {
        // Make them an admin using both fields for compatibility
        await prisma.user.update({
          where: { id: firstUser.id },
          data: { 
            role: 'admin' 
          }
        })
        
        console.log(`First user ${firstUser.email} has been made an admin`)
        return true
      }
    }
    
    return false
  } catch (error) {
    console.error('Error ensuring first user is admin:', error)
    return false
  }
}

/**
 * Create the first admin user if no users exist
 */
export async function createFirstAdminIfNeeded(email: string, password: string, name?: string) {
  try {
    const userCount = await prisma.user.count()
    
    if (userCount === 0) {
      // We'll need to use Better Auth to create this user properly
      // This function is a placeholder for manual admin creation
      console.log('No users found. First user registration will be automatically made admin.')
      return true
    }
    
    return false
  } catch (error) {
    console.error('Error creating first admin:', error)
    return false
  }
}