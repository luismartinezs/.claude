# general "default" coding workflow

This is your baseline general-purpose default coding workflow

Assumptions:
- you have a codebase with milestones, each milestone split into features
- some of the milestones / features are already implemented (start and end steps might different from following)

## workflow
- Select ongoing / next milestone to deliver, e.g. milestone #2
- From that milestone, select the next feature to implement, e.g. feature "#13 lorem ipsum"
  - feature complexity should be 2-3 in terms of planning poker. If it is > 3, split it down further
- checkout to a new feature branch, I suggest naming it "m2-13-lorem-ipsum" or similar
- start implementing. Here we follow a TDD workflow because it seems to provide high accuracy and DX
- run these commands (TDD):
  - /engineering:tdd:define-acceptance-criteria [paste the description of the feature to implement]
    - provide as many details as needed
    - most important: provide clearly defined deliverables
  - /engineering:tdd:scaffold-tests
    - same chat as previous
  - read the tests, don't skip this. at least skim the tests to see if they make sense. These tests are the most important part of the workflow, the AI can forget testing things
  - commit the tests
  - /engineering:tdd:implement [test file or tests that must pass]
    - new chat
  - /engineering:tdd:review-code
    - new chat, run with staged changes
- all tests must pass before moving forward, if they don't, prompt to fix one by one
- run typecheckers, linters, formatters...
- commit the implementation
- do not merge to master yet, branch from this feature branch, and repeat the loop to handle the next feature
- once all the features of the milestone have been implemented, run the following steps. If you think any feel overkill, just skip them
  - run security audit: repomix to gemini (large context), use the prompt context/prompts/security-audit.md, read output, and ask claude to solve what you consider that needs to be solve
  - run context/prompts/quality-assurance-checklist.md in a new claude code chat
    - [TODO]: would be better to turn into subagent
  - run any other audits, e.g. code complexity, vertical slice, etc (prompts not provided)
  - if a PR-CHECKLIST.md exists, run `go over the checklist in @PR-CHECKLIST.md and complete for current branch. think hard`
    - PR-CHECKLIST.md is a file that you can customize for your repo, see context/templates/PR-CHECKLIST.md
- merge to main branch

## other workflows

Other workflows you might consider

### EPE
### OODA


# Notes

- Do not run multistep workflows using subagents. Subagents easily lose the global context. Use commands instead
- A good use case for subagents is to create specific domain reports for later use (e.g. run specific audit and generate a report)