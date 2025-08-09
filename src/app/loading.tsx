import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function Loading() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        {/* Header Loading */}
        <div className="mb-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-10 w-64" />
              </div>
              <Skeleton className="h-5 w-96" />
              <div className="flex gap-4 pt-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-18" />
              </div>
            </div>
            <Skeleton className="h-11 w-44" />
          </div>
        </div>

        {/* Search Bar Loading */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          <Skeleton className="flex-1 h-11" />
          <div className="flex gap-2">
            <Skeleton className="h-11 w-16" />
            <Skeleton className="h-11 w-20" />
            <Skeleton className="h-11 w-20" />
          </div>
        </div>

        {/* Server Cards Loading */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-start justify-between mb-3">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-8 w-8" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-6 w-32" />
                </div>
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3.5 w-3.5" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <div>
                  <Skeleton className="h-4 w-24 mb-2" />
                  <div className="flex gap-1">
                    <Skeleton className="h-5 w-12" />
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-10" />
                  </div>
                </div>
                <div className="pt-3 flex justify-between items-center border-t">
                  <Skeleton className="h-4 w-12" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}