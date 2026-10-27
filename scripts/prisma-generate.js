// Finds prisma wherever npm hoisted it (root or workspace node_modules)
const { execFileSync } = require('child_process');
const path = require('path');

let prismaPath;
try {
  prismaPath = require.resolve('prisma/build/index.js');
} catch {
  // fallback: workspace-local
  prismaPath = path.join(__dirname, '../apps/backend/node_modules/prisma/build/index.js');
}

execFileSync(process.execPath, [
  prismaPath,
  'generate',
  '--schema=apps/backend/prisma/schema.prisma',
], { stdio: 'inherit' });
