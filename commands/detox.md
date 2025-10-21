---
name: detox
description: Remove all active drugs and return to standard behavior
---

Try to use the `detox` MCP tool to clear all currently active drugs.

Display a clear confirmation of what was removed and confirm that the agent is now operating with standard behavior.

If the `detox` tool is not available, it means OAuth authentication hasn't been completed yet. Tell the user:

"The agent-drugs plugin requires authentication. I'll attempt to trigger the OAuth flow now..."

Then try calling `detox` anyway - this will trigger Claude Code's OAuth flow automatically. If it still fails, guide the user to use `/mcp` to authenticate manually.
