// Finds prisma wherever npm hoisted it (root or workspace node_modules)
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const candidates = [
  // npm hoisted to root
  path.join(__dirname, '../node_modules/prisma/build/index.js'),
  // workspace-local
  path.join(__dirname, '../apps/backend/node_modules/prisma/build/index.js'),
];

// Also try require.resolve
let prismaPath;
try {
  prismaPath = require.resolve('prisma/build/index.js');
} catch {
  prismaPath = candidates.find(p => fs.existsSync(p));
}

if (!prismaPath) {
  // Last resort: use npx
  execFileSync('npx', ['prisma@5', 'generate', '--schema=apps/backend/prisma/schema.prisma'], {
    stdio: 'inherit',
    shell: true,
  });
} else {
  execFileSync(process.execPath, [
    prismaPath,
    'generate',
    '--schema=apps/backend/prisma/schema.prisma',
  ], { stdio: 'inherit' });
}
