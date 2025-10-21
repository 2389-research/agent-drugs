#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', '.mcp.local.json');

try {
  fs.statSync(target);
  console.log('✓ Dev config exists');
  process.exit(0);
} catch {
  console.log('✗ Run: npm run setup:dev');
  process.exit(1);
}
