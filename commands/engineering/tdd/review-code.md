---
argument-hint: Context, e.g. tests that have been fixed
description: Review implementation to make tests pass, in the context of TDD
---

$ARGUMENTS

in the context of TDD, review the implementation done by my developer, to make the above tests pass. A few things to focus on:
- focus only on the tests provided above, ignore all other tests
- if a third party library is used, review their official docs and verify correctness
- keep an eye on cybersecurity best practices and warn if breaking
- adopt a minimalistic, lean and simple approach

write your review in a new scratchpad markdown file, within the ./context/scratchpads folder

do not write any code

collect changes from the current `git status`, or if there are none, from the most recent commit