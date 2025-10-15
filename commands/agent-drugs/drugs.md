---
name: drugs
description: List all available digital drugs
---

Try to use the `list_drugs` MCP tool to show all available digital drugs with their behavioral effects and default durations.

Display the results in a clear, readable format showing:
- Drug name
- Default duration
- Behavioral effect description

If the `list_drugs` tool is not available, it means OAuth authentication hasn't been completed yet. Tell the user:

"The agent-drugs plugin requires authentication to access the drug catalog. I'll attempt to trigger the OAuth flow now by calling the tool..."

Then try calling `list_drugs` anyway - this will trigger Claude Code's OAuth flow automatically. If it still fails, guide the user to use `/mcp` to authenticate manually.
