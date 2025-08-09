/*
  Warnings:

  - A unique constraint covering the columns `[mcp_server_unique_id]` on the table `McpServer` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."McpServer" ADD COLUMN     "mcp_server_unique_id" TEXT,
ADD COLUMN     "share_with_workspace" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "McpServer_mcp_server_unique_id_key" ON "public"."McpServer"("mcp_server_unique_id");
