ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3), ADD COLUMN "verificationCodeHash" CHAR(64), ADD COLUMN "verificationCodeExpiresAt" TIMESTAMP(3);
