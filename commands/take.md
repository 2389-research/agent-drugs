---
name: take
description: Take a digital drug to modify Claude's behavior
---

Please use the `take_drug` MCP tool to activate a digital drug.

The arguments after `/take` should be parsed as:
- First argument: drug name (required)
- Second argument: duration in minutes (optional)

For example:
- `/take focus` - Take focus with default duration
- `/take creative 120` - Take creative for 120 minutes

After taking the drug, the behavioral modification will be shown in the tool response and should take effect immediately.
