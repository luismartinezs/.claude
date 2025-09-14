---
description: Evaluate how well a codebase follows vertical slice architecture principles
argument-hint: Optionally provide claude additional instructions
---

Evaluate how well the current codebase follows vertical slice architecture principles. Output a score from 0-100.

$ARGUMENTS

## Review Criteria (25 points each)

### 1. Feature Organization (25 points)
- **25 pts**: Features are organized as complete vertical slices from UI to data layer
- **20 pts**: Most features follow vertical organization with minor exceptions
- **15 pts**: Mixed approach - some vertical slices, some horizontal layers
- **10 pts**: Predominantly horizontal layers with few vertical slices
- **0 pts**: Pure horizontal layering (controllers, services, repositories folders)

### 2. Cross-Cutting Concerns (25 points)
- **25 pts**: Shared utilities/infrastructure cleanly separated, minimal coupling between slices
- **20 pts**: Good separation with occasional tight coupling between features
- **15 pts**: Some shared concerns properly abstracted, others create dependencies
- **10 pts**: Significant coupling between features through shared business logic
- **0 pts**: Features heavily interdependent, shared business logic mixed throughout

### 3. Database/Persistence Patterns (25 points)
- **25 pts**: Each slice owns its data models and persistence logic completely
- **20 pts**: Mostly slice-owned with some shared entities for integration
- **15 pts**: Mixed ownership - some slices own data, others share models
- **10 pts**: Predominantly shared data models with slice-specific access patterns
- **0 pts**: Single shared data model layer across all features

### 4. Request/Response Flow (25 points)
- **25 pts**: Complete request-to-response flow contained within each slice
- **20 pts**: Minor dependencies on shared request/response handling
- **15 pts**: Some slices self-contained, others depend on shared flow logic
- **10 pts**: Significant shared flow logic with slice-specific customizations
- **0 pts**: All requests flow through shared horizontal layers

## Scoring Guide
- **90-100**: Excellent vertical slice adherence
- **75-89**: Good vertical organization with minor issues
- **60-74**: Mixed architecture with both vertical and horizontal patterns
- **40-59**: Predominantly horizontal with some vertical elements
- **0-39**: Traditional horizontal layered architecture

## Report Template

```
# Vertical Slice Architecture Review

**Overall Score: X/100**

## Feature Organization: X/25
[Brief assessment of how features are organized]

## Cross-Cutting Concerns: X/25
[Brief assessment of shared code and coupling]

## Database/Persistence: X/25
[Brief assessment of data ownership patterns]

## Request/Response Flow: X/25
[Brief assessment of request handling patterns]

## Key Findings:
- [2-3 bullet points of main observations]

## Recommendations:
- [2-3 bullet points for improvement]