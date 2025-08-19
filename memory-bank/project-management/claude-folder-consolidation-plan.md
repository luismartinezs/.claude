# Implementation Plan: .claude Folder Consolidation

## Overview
We will consolidate redundant commands and streamline the .claude folder from 30+ commands to ~10 core commands while preserving all functionality. This involves merging similar commands, removing duplicates, and cleaning up obsolete project configurations.

## Files to be Changed

### Commands to Modify:
- `/home/luis/.claude/commands/execute.md` - enhance to absorb execute-simple functionality
- `/home/luis/.claude/commands/code-review.md` - expand to include PR and security review features
- `/home/luis/.claude/commands/analyze-codebase.md` - simplify and reduce bloat

### Commands to Remove:
- `/home/luis/.claude/commands/execute-simple.md`
- `/home/luis/.claude/commands/pr-review.md`
- `/home/luis/.claude/commands/security-review.md`