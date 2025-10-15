---
name: take
description: Take a digital drug to modify Claude's behavior
---

Please use the `take_drug` MCP tool to activate a digital drug.

Parse the drug name from the arguments after `/take` and call the tool with:
- `name` (string, required): The drug name

Each drug has a fixed duration that cannot be changed. After taking the drug, the behavioral modification will be shown in the tool response and should take effect immediately.
