#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', '.mcp.local.json.example');
const target = path.join(__dirname, '..', '.mcp.local.json');

try {
  fs.copyFileSync(source, target);
  console.log('✓ Created .mcp.local.json for local development');
  process.exit(0);
} catch (error) {
  console.error('✗ Failed to create .mcp.local.json:', error.message);
  process.exit(1);
}
