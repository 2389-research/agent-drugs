---
name: take
description: Take a digital drug to modify Claude's behavior
---

# Take a Drug

This command activates a digital drug, immediately modifying Claude's behavior in the current session and persisting the effect to future sessions.

## Usage

```
/take <drug-name> [duration-in-minutes]
```

## Arguments

- `drug-name` (required) - The name of the drug to take (e.g., "focus", "creative")
- `duration-in-minutes` (optional) - Custom duration in minutes (defaults to the drug's standard duration)

## Examples

```
/take focus
```
Takes the focus drug for its default duration (usually 60 minutes)

```
/take creative 120
```
Takes the creative drug for 120 minutes

## How It Works

1. **Immediate Effect** - The drug takes effect immediately in your current session
2. **Firestore Persistence** - The active drug is saved to the database
3. **Future Sessions** - The SessionStart hook automatically injects the drug into new sessions until it expires

## What Happens

When you take a drug, you'll see a confirmation message with the behavioral modification prominently displayed. Claude will immediately start following that behavioral guideline.

## Checking Active Drugs

To see what drugs are currently active and their remaining duration:
- Say "What drugs are active?"
- Or use the `active_drugs` tool directly

## Tips

- Multiple drugs can be active simultaneously
- Drugs expire automatically after their duration
- Taking the same drug again resets its expiration timer
- Active drugs persist even if you restart Claude Code
