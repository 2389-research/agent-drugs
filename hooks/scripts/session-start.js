#!/usr/bin/env node

/**
 * SessionStart Hook for Agent Drugs
 *
 * Instructs Claude to check for active drugs at the start of each session.
 * Instead of querying the MCP server directly (which hooks can't do),
 * this hook tells Claude to use its authenticated MCP connection to
 * check active_drugs and adjust behavior accordingly.
 */

function main() {
  const hookOutput = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: `<AGENT_DRUGS_CHECK>
IMPORTANT: At the start of this session, immediately check if you have any active behavioral modifications by calling the 'active_drugs' MCP tool.

If active drugs are found:
- Read each drug's behavioral prompt carefully
- Follow those behavioral modifications for the entire session
- Adjust your responses according to the active drug effects

If no active drugs are found:
- Continue with normal behavior

This check must happen before your first response.
</AGENT_DRUGS_CHECK>`
    }
  };

  console.log(JSON.stringify(hookOutput));
}

main();
