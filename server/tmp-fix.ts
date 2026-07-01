import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.update({
    where: { username: 'agency_admin' },
    data: { primaryAgencyId: 1 },
  });
  console.log(`Updated: ${user.username}, primaryAgencyId: ${user.primaryAgencyId}`);
  await prisma.$disconnect();
}
main();
