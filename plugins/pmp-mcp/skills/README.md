# pmp-mcp skills

Pre-tool-call reasoning, shipped inside the package so it travels with the server. Portable
across agents: `pmp-mcp install --agent <claude|codex|cursor|opencode|all>` copies these
directories where that agent looks (`.claude/skills` for Claude Code, `.agents/skills` for
Codex/Cursor/opencode). Claude Code also auto-discovers them from a loaded plugin, namespaced
`pmp-mcp:<skill>`.

| Skill | Use when |
| --- | --- |
| `pmp-mcp-quickstart` | Configuring `pmp-mcp`, first run, a start that refuses, or funding the pool. |
| `explore-markets` | Finding a market, or reading its price and order constraints. |
| `plan-betting-strategy` | Sizing and staging a position under the operator's caps. |
| `write-trading-bot` | Scripting against `@starkware-libs/pmp-trading-core` directly. |

`install` copies skill DIRECTORIES only, so this file never reaches an installed agent: the
same routing lives in a `## Which skill` block inside every SKILL.md, and the drift test pins
the two together. Edit both.

Frontmatter is the agentskills.io subset only (`name`, `description`, optionally `license`,
`compatibility`, `metadata`) so every agent can load these unchanged.

Each skill is self-sufficient on its own tool sequence, and DELEGATES doctrine depth to the
server: the `instructions` block in `src/doctrine.ts` (sent at MCP initialize) and the `trade` /
`recover` / `close-out` prompts in `src/playbooks.ts`. Whether a non-Claude-Code client surfaces
those prompts is client-specific, so a skill names them as the canonical playbook *if your client
lists MCP prompts* — never as the only path.
