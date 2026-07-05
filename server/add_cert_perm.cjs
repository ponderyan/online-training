const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addCertPermissions() {
  // Find admin roles
  const roles = await prisma.role.findMany({
    where: { OR: [{ name: '超级管理员' }, { name: '系统管理员' }, { name: '管理员' }, { name: 'admin' }] }
  });
  
  const perms = ['cert:view', 'cert:issue', 'cert:revoke', 'cert:approve', 'cert:reject', 'cert:application_view'];
  
  for (const role of roles) {
    for (const perm of perms) {
      const existing = await prisma.rolePermission.findFirst({
        where: { roleId: role.id, permission: perm }
      });
      if (!existing) {
        await prisma.rolePermission.create({ data: { roleId: role.id, permission: perm } });
        console.log(`  + ${perm} -> ${role.name}`);
      }
    }
  }
  
  console.log(`✅ Updated ${roles.length} roles`);
  
  // Verify
  const allRp = await prisma.rolePermission.findMany({ where: { roleId: { in: roles.map(r => r.id) } } });
  console.log(`Total permissions: ${allRp.length}`);
  for (const rp of allRp) {
    const role = roles.find(r => r.id === rp.roleId);
    console.log(`  ${rp.permission} (${role?.name || '?'})`);
  }
  
  await prisma.$disconnect();
}

addCertPermissions().catch(e => { console.error(e); process.exit(1); });
