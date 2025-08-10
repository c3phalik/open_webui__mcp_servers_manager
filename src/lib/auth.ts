import { betterAuth } from "better-auth"
import { createAuthMiddleware } from "better-auth/api"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { admin } from "better-auth/plugins/admin"
import { prisma } from "./prisma"

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  database: prismaAdapter(prisma, {
    provider: "postgresql"
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true in production
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || "http://localhost:3000"
  ],
  plugins: [
    admin({
      defaultRole: 'user'
    })
  ],
  hooks: {
    after: createAuthMiddleware(async (ctx: any) => {
      // Check if this is a user signup
      if (ctx.path === "/sign-up/email" && ctx.context.newSession) {
        try {
          const user = ctx.context.newSession.user
          console.log(`🔄 After signup hook fired for user: ${user.email} (ID: ${user.id})`)
          
          // Wait a small moment to ensure user is fully committed to database
          await new Promise(resolve => setTimeout(resolve, 100))
          
          // Count total users after this user was created
          const userCount = await prisma.user.count()
          console.log(`📊 Total users in database: ${userCount}`)
          
          if (userCount === 1) {
            // This is the first user - update them to admin
            console.log(`👑 First user detected! Promoting ${user.email} to admin...`)
            
            const updatedUser = await prisma.user.update({
              where: { id: user.id },
              data: { role: 'admin' }
            })
            
            console.log(`✅ SUCCESS: First user ${user.email} promoted to admin!`, {
              id: updatedUser.id,
              email: updatedUser.email,
              role: updatedUser.role
            })
          } else {
            console.log(`👤 Subsequent user ${user.email} keeps default 'user' role (user #${userCount})`)
          }
          
        } catch (error) {
          console.error(`❌ CRITICAL ERROR in after signup hook:`, error)
          console.error('Stack trace:', error instanceof Error ? error.stack : String(error))
          // Don't throw to avoid breaking user creation, but log extensively
        }
      }
    })
  }
})

export type Session = typeof auth.$Infer.Session