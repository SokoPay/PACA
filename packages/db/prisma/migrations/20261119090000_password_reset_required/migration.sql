-- After 3 wrong passwords an account locks for 30 minutes; one more wrong
-- password after that means the member must reset their password.
ALTER TABLE "users" ADD COLUMN "passwordResetRequired" BOOLEAN NOT NULL DEFAULT false;
