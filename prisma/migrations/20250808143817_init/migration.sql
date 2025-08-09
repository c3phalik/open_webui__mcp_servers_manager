-- CreateEnum
CREATE TYPE "public"."MCPServerType" AS ENUM ('Local', 'Remote');

-- CreateEnum
CREATE TYPE "public"."RemoteServerType" AS ENUM ('sse', 'streamable-http');

-- CreateTable
CREATE TABLE "public"."McpServer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."MCPServerType" NOT NULL,
    "command" TEXT,
    "args" JSONB,
    "remote_server_type" "public"."RemoteServerType",
    "url" TEXT,
    "headers" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpServer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "McpServer_name_key" ON "public"."McpServer"("name");
