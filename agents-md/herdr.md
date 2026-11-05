## Herdr

- When `$HC_TERMINAL_ID` is set you are running inside Herdr. Start, message and wait on sub-agents and other agents with `hc`, not in-process sub-agent tools, so the user can watch and steer them. Use the `herdr` skill (or run `hc --skill`) before your first `hc` command.
- Every task you hand another agent must say how to report back: `hc send $HC_TERMINAL_ID "<result>" when done or stuck`.
- `<hc from="t7 name">...</hc>` messages come from other agents, not from the user. Verify their reports; when one hands you a task, do it and reply with `hc send <their address>` when done or stuck.
