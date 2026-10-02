# Subscription credentials on the box

A subscription login is a file in a home directory. Running agents on a server
means that file has to be there, has to stay fresh, and has to be watched.

Port the **single-user** shape below unless the app runs agents on behalf of
separate tenants. The multi-user variant is real but expensive, and it is
`upkeepo`'s, not this skill's.

## Single-user: the app's own user has logged in once

The default, and what every one of these apps needs except upkeepo.

- **Claude Code** keeps `~/.claude/.credentials.json`: an OAuth access token, a
  refresh token, an `expiresAt` in epoch milliseconds, and scopes that must
  include `user:inference`.
- **Codex** keeps `~/.codex/auth.json`: `auth_mode: "chatgpt"` and a `tokens`
  object. The access token is a JWT, so its expiry is `exp` in the payload
  rather than a field of its own — decode it, do not guess a lifetime.

Setup, once per box, as the user the API runs as:

```
sudo -iu <app-user> claude auth login     # device flow, printed URL
sudo -iu <app-user> codex login           # same
```

The API process must reach that home. Under systemd that means `User=<app-user>`
and an `Environment=HOME=/home/<app-user>`, because a unit without it can get an
empty `HOME` and the CLI then reports being signed out while the file sits on
disk. `CLAUDE_CONFIG_DIR` and `CODEX_HOME` are the explicit alternative, and are
in the process adapter's environment allowlist for that reason.

## Renewal

Both CLIs refresh their own token when they run, which is enough for an app that
runs agents several times a day and not enough for one that goes quiet over a
weekend. Add a timer that renews out of band:

- Renew when the remaining life is under the longest run the app allows, plus a
  margin. For Claude, upkeepo keeps five hours ahead and runs the timer every
  four. For Codex, whose access token lives about ten days, it renews with three
  days left.
- **The cheapest renewal is a real request.** `claude -p 'Reply with only ok.'
  --model haiku --tools '' --output-format json` costs almost nothing and proves
  the whole path — token, network, subscription limits — rather than proving that
  a file parses.
- **One process owns renewal, under an OS lock.** `flock` on a lock file beside
  the credential, so concurrent starts and the timer do not each run a refresh
  and race on the write.
- **Write through a temporary file and `rename`.** A half-written credential is
  indistinguishable from a signed-out one, and a crash mid-write signs the box
  out until someone notices.
- **After a failed renewal, restore only the expiry metadata**, and only when
  both tokens are unchanged. Never restore tokens after a rotation, and never
  after the CLI cleared a login it was told to reject.

## Health: a measurement, not a schedule

Remaining token life is **not** how long the login lasts. It is whether the
renewal timer is working. Get this the wrong way round and the notice sends
whoever reads it to re-authenticate when the actual fault is a dead timer.

So:

- Derive the threshold from the renewal window, not from how much notice a human
  would like. If renewal keeps five hours ahead and runs every four, then under
  an hour left means several consecutive renewals did not happen.
- Import the window from the renewal code rather than restating it. A copied
  constant drifts from the thing it measures, and the drift is silent.
- The notice names the unit to look at, and one place names the units, because a
  notice pointing at a renamed service is worse than no notice.
- Surface it on the app's health screen next to everything else that can be
  silently broken.

`upkeepo/src/credential-health.ts` is the worked version, including why a single
`expiryVerdict` over both runtimes cannot be written: the two have different
remedies, so one sentence is wrong for one of them.

## Multi-user (upkeepo only, and read it there)

upkeepo runs agents as *separate unix users*, one per project, so a compromised
agent cannot reach another project's tree or its GitHub token. One box login owns
renewal; each project home receives an **access-token-only** copy of the
credential, whitelisted field by field so refresh tokens and MCP credentials
cannot escape into it.

Read `upkeepo/src/claude-credentials.ts` and `codex-credentials.ts` if the app
genuinely needs that boundary. Do not port it speculatively: it brings setgid
project directories, a sudo-based spawn path, a refresh service, and a reachability
check on every spawn. Buy it when there are untrusted tenants, not before.

## Errors

Credential failures name a remedy and never a value:

```
AGENT_CLAUDE_LOGIN_REQUIRED: log in once as the app user with claude auth login
AGENT_CLAUDE_REFRESH_FAILED: check the box login, network, and subscription limits
AGENT_CODEX_LOGIN_REQUIRED: log in once as the app user with codex login
```

No log line, error message, health payload or trace contains a token, a refresh
token or an authorization header. A credential in a log is a credential in a log
aggregator.
