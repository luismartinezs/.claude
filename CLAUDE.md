### Doctrine

Doctrine is a private git repo of instructions and context for coding agents,
shared across projects: github.com/luismartinezs/doctrine. Always use the latest
version. It is cloned at `~/doctrine`; if the clone is missing, read a file with
`gh api repos/luismartinezs/doctrine/contents/<file> -H "Accept: application/vnd.github.raw"`.
A reference written as `doctrine/<file>.md` means that file in this repo.
Architecture is `doctrine/software-architecture.md`; deployment and VPS is
`doctrine/infra.md`. Read them when the work touches how a product is built or
shipped, not every session.

A product build takes two inputs read directly by whoever builds, both in the
product repo: a functional spec (`docs/spec.md`, from pawaspec) and a visual
contract (`docs/design/design.md`, with its reference images and assets). Neither is transcribed into an intermediate format
first.

Grounding is per project: read `context/MEMORY.md` and `CLAUDE.md` relative to
the project root.

### Google Calendar

Use the "Claude Tasks" calendar for scheduling actions, reminders, and deadlines.
- Calendar ID: `515eca68a9a433d17d4b58f8c51d1fd2dd1ea29e1dcfd33fd6e43c94bb1345dc@group.calendar.google.com`
- Timezone: Asia/Bangkok
- Do NOT put events on Luis's personal or "schedule" calendars. Only use "Claude Tasks".

