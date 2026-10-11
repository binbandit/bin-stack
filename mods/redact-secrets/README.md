# redact-secrets

Swaps secrets for placeholders like `[REDACTED:github-token:3f9a1c2b]` before Claude reads them, and before the session writes them to its transcript.

## What it covers

- **Tool results.** Every tool's result is scanned, including Read, Bash, Grep, MCP tools and subagents' tools. The scan applies to what the model reads and to the record the transcript stores.
- **Transcript rows.** Every row is scanned before it is stored: prompts, replies, tool results, reminders and compaction summaries.
- **Prompts.** A secret you paste is redacted before the prompt is queued.
- **`@` mentions.** A mentioned file that holds a secret is not attached. Claude is told to open it with Read instead, so the redacted copy is the only one in the log.
- **OpenTelemetry.** String attributes sent to your collector are scanned.

It detects:

- Private keys (PEM, including truncated slices)
- AWS, GitHub, GitLab, Anthropic, OpenAI, Stripe, Slack, Google, npm, Hugging Face and SendGrid tokens
- JWTs and URL passwords
- Bearer and Basic auth headers
- Values assigned to secret-looking names (`DB_PASSWORD=`, `apiKey: "..."`)

Once a secret has been seen, it is also redacted wherever it shows up later, for example in `echo $DB_PASSWORD`.

## Writing secrets back

Within a session, each placeholder maps back to its real value:

- **Write, Edit and NotebookEdit** put the real value back. Claude can rewrite `.env` or edit around a key without destroying it.
- **Shell commands** that carry a placeholder are refused, so Claude can't echo one over a real file.
- **Placeholders from before a reload** (`/reload-plugins`) are refused until Claude reads the file again.

## What it cannot reach

- The first prompt of a headless `claude -p` run. The engine queues it before any plugin hook runs, so its `queue-operation` entry keeps the raw text.
- An injected attachment's raw payload, such as a "file changed on disk" snippet. The model reads the redacted rendering, but the transcript keeps the engine's record.
- The screen, before a row's rewrite lands, and the `--debug` log.
- Secrets in a shape it doesn't recognise. A bare dictionary-word password in YAML (`password: correcthorse`) isn't caught.
