---
name: active
description: Check currently active drugs and remaining duration
---

Try to use the `active_drugs` MCP tool to show all currently active drugs and their remaining time.

Display the results clearly showing:
- Drug name
- Remaining duration
- When the drug will expire

If the `active_drugs` tool is not available, it means OAuth authentication hasn't been completed yet. Tell the user:

"The agent-drugs plugin requires authentication. I'll attempt to trigger the OAuth flow now..."

Then try calling `active_drugs` anyway - this will trigger Claude Code's OAuth flow automatically. If it still fails, guide the user to use `/mcp` to authenticate manually.
