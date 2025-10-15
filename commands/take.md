---
name: take
description: Take a digital drug to modify Claude's behavior
---

Please use the `take_drug` MCP tool to activate a digital drug.

Parse the arguments after `/take` as:
- First argument: drug name (required)
- Second argument: duration in minutes (optional, uses drug's default if not provided)

Call `take_drug` with the parsed arguments. The tool accepts:
- `name` (string, required): The drug name
- `duration` (number, optional): Custom duration in minutes (1-1440)

After taking the drug, the behavioral modification will be shown in the tool response and should take effect immediately.
