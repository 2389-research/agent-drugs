---
name: drugs
description: List all available digital drugs
---

# List Available Drugs

This command shows all available digital drugs with their behavioral effects and default durations.

When you run this command, it calls the `list_drugs` MCP tool to fetch the current catalog from the server.

## Usage

```
/drugs
```

## What You'll See

Each drug listing includes:
- **Name** - The drug identifier (used with `/take` command)
- **Duration** - Default duration in minutes
- **Effect** - The behavioral modification this drug provides

## Examples

After running `/drugs`, you might see:

- **focus** (60 min) - Extremely focused and detail-oriented
- **creative** (120 min) - Thinks outside the box and proposes novel solutions
- **concise** (30 min) - Responds with brevity, gets straight to the point
- **verbose** (90 min) - Provides detailed explanations with examples

## Next Steps

To take a drug:
- Use `/take <drug-name>` command
- Or say "Take the [drug name]"
- Or use the `take_drug` tool directly
