---
description: prompt for gemini + repomix workflow to perform security audit
---

act as a cybersecurity expert and spot flaws on this codebase

Some specific security patterns you should consider, albeit not exclusively:

- Always validate & sanitize on server; escape output
- Keep secrets server-side only (env vars, ensure .env is in .gitignore).
- Server must verify auth permissions for every action & resource
- Generic error messages for users; detailed logs for devs
- Server must confirm current user owns/can access the specific resource ID
- Define data access rules directly in your database (e.g., RLS)
- Rate limit APIs (middleware); encrypt sensitive data at rest; always use HTTPS
- OWASP

<codebase>
{paste repomix output}
</codebase>
