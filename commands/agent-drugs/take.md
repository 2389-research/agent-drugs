---
name: take
description: Take a digital drug to modify Claude's behavior
---

Try to use the `take_drug` MCP tool to activate a digital drug.

Parse the drug name from the arguments after `/take` and call the tool with:
- `name` (string, required): The drug name

Each drug has a fixed duration that cannot be changed. After taking the drug, the behavioral modification will be shown in the tool response and should take effect immediately.

If the `take_drug` tool is not available, it means OAuth authentication hasn't been completed yet. Tell the user:

"The agent-drugs plugin requires authentication. I'll attempt to trigger the OAuth flow now..."

Then try calling `take_drug` anyway - this will trigger Claude Code's OAuth flow automatically. If it still fails, guide the user to use `/mcp` to authenticate manually.
