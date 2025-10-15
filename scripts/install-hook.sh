#!/usr/bin/env bash

# Post-install script for agent-drugs plugin
# Makes hook scripts executable and provides helpful setup information

set -e

echo "🎨 Configuring Agent Drugs plugin..."

# Make hook script executable
chmod +x "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/session-start.js"

echo "✅ Hook scripts configured"
echo ""
echo "🔐 Authentication: You'll be prompted to sign in with Google on first use"
echo ""
echo "💊 Quick Start:"
echo "   • List available drugs: /drugs"
echo "   • Take a drug: /take focus"
echo "   • Check active drugs: 'What drugs are active?'"
echo ""
echo "📚 See CLAUDE.md for more information"
echo ""
echo "Happy experimenting! 🧪"
