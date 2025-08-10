/*
  Warnings:

  - You are about to drop the `Member` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Organization` table. If the table is not empty, all the data it contains will be lost.

*/

-- AlterTable: Add isAdmin column first
ALTER TABLE "public"."User" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Migrate existing admin roles from Member table to User.isAdmin
UPDATE "public"."User" 
SET "isAdmin" = true 
WHERE "id" IN (
  SELECT "userId" 
  FROM "public"."Member" 
  WHERE "role" = 'admin'
);

-- Delete the demo admin user
DELETE FROM "public"."User" WHERE "email" = 'admin@example.com';

-- DropForeignKey
ALTER TABLE "public"."Member" DROP CONSTRAINT "Member_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Member" DROP CONSTRAINT "Member_userId_fkey";

-- DropTable
DROP TABLE "public"."Member";

-- DropTable
DROP TABLE "public"."Organization";
