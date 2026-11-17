## Herdr

- When `$HC_TERMINAL_ID` is set you are running inside Herdr. Start, message and wait on sub-agents and other agents with `hc`, not in-process sub-agent tools (such as Claude Code's Agent tool and its Explore or fork agents), even when a skill says to spawn one, so the user can watch and steer them. Load the `herdr` skill before you start or coordinate agents. Reporting back or replying needs only the `hc send` line you were given: do not load the skill or run `hc --skill` for that.
- Every task you hand another agent must say how to report back: `hc send $HC_TERMINAL_ID "<result>" when done or stuck`.
- `<hc from="t7 name">...</hc>` messages come from other agents, not from the user. Verify their reports; when one hands you a task, do it and reply with `hc send <their address>` when done or stuck.
