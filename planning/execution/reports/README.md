# Task reports

Workers write one report per task ID; only lead updates shared queue/checkpoint. Report fields:

- Task/role/actual host handle or sequential fallback.
- Exact owned paths and files changed.
- Resulting behavior and interfaces.
- Checks actually run, environment, assertions, outcome and evidence paths.
- Review findings with severity, location, trigger, expected behavior and affected requirement IDs.
- Remaining limits/block reason/next action.

Worker result is READY_FOR_REVIEW or BLOCKED. Orchestrator reruns relevant integrated checks before VERIFIED. Audit-task VERIFIED means report complete; any product defects remain in X01/final gate. No generic “tests pass” without identifying real checks.
