# convert feature draft to spec

Use the following prompts to convert a rough feature idea into a functional specification


## Prompt 1:


```
You are a Senior Product Manager and Lead Engineer. I am providing a rough feature draft below.

Do not write the spec yet. Instead, analyze the draft and identify the top 5 logical gaps, edge cases, or state-transition ambiguities that would cause a developer to get stuck or a user to have a bad experience.

Output these as 5 specific questions

feature draft:
```

## Prompt 2 (follow up):

```
Act as the Lead Product Owner. Resolve these 5 questions using your best judgment to maximize User Experience and Engineering Simplicity.

Then, write the full Functional Specification incorporating those decisions. Include sections for Core Behavioral Rules, State Transitions, and Edge Cases

Write the spec in a markdown file
```


# convert spec to plan

Use the following prompt to convert a feture spec into a technical implementation plan using vertical slice architecture

```
Generate a technical implementation plan for the feature spec provided below.

Follow Vertical Slice Architecture principles:
1. DESIGN: Identify if this slice requires Logic (Commands/Strategies) or is purely UI/Content.
2. STRUCTURE: Outline a folder structure within `src/modules/` that encapsulates the feature.
3. PUBLIC API: Define the gatekeeper file (`.public.ts`) for the module.
4. FRICTION: Identify which ESLint or Dependency-Cruiser rules will prevent this slice from coupling with others.
5. LOGIC (If Applicable): If the feature involves business logic, describe the Command and how it uses the CommandRunner. If it is purely UI, omit the Command pattern.

Feature Spec:
[feature spec]
```