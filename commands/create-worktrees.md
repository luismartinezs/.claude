---
description: create worktrees for all open PRs and interactively create new branches with worktrees
---
# Git Worktree Commands

This documentation provides two main bash scripts for Git worktree management:

## 1. Create Worktrees for All Open PRs
- Uses GitHub CLI to fetch open pull requests
- Creates git worktrees for each PR branch
- Handles branch names with slashes
- Includes an optional cleanup script for stale worktrees

## 2. Interactive Branch and Worktree Creation
- Prompts for a new branch name
- Validates branch name
- Creates a worktree in a `./tree/` directory
- Supports creating branches from different base commits

## Key Features
- Error handling
- Directory management
- Flexible branch creation options
- Streamlined Git workflow by making branch and worktree management more efficient