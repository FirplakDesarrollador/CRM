---
trigger: always_on
---

When executing terminal commands, do NOT use pipes (|), OR operators, or compound commands.

Always split operations into single, independent commands.

Example:
Instead of:
git branch -a | findstr "quirky-gagarin"

Use:
git branch -a
Then filter results internally in reasoning.

Rationale:
Compound commands break command whitelisting and trigger unnecessary run confirmations.