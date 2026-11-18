-- AlterTable
ALTER TABLE "Donation" ADD COLUMN     "stripeCheckoutId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Donation_stripeCheckoutId_key" ON "Donation"("stripeCheckoutId");

