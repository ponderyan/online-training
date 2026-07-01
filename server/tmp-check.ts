import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const users = await p.user.findMany({
    where: { primaryAgencyId: 1 },
    select: { id: true, username: true, displayName: true, primaryAgencyId: true, isActive: true }
  });
  console.log(JSON.stringify(users));
  await p.$disconnect();
})();
