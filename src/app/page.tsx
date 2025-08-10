"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import ServersList from "@/components/servers-list"

export default function Page() {
  return (
    <ProtectedRoute>
      <ServersList />
    </ProtectedRoute>
  )
}
