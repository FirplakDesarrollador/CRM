---
description: Enforces logging and validation of bugs using bugs-knowhow.md to prevent repeated errors and unsafe code.
---

# Bugs Knowhow Enforcer

## Goal
Prevent the generation of incorrect, unstable, or harmful code by enforcing a continuous validation loop using a persistent bug knowledge file.

---

## Core Principle

Every past mistake is a constraint.

If it is not checked → it will be repeated.

---

## File

bugs-knowhow.md = single source of truth for past bugs

---

## Workflow

### Step 1 — Load Memory (MANDATORY)

- Check if bugs-knowhow.md exists  
- If NOT → create it  
- If YES → read it before coding  

---

### Step 2 — Extract Rules

From bugs-knowhow.md, identify:

- Prevention Rules  
- Relevant technologies  
- Known failure patterns  

Only keep what applies to the current task

---

### Step 3 — Pre-Validation

Before writing code:

- Check planned approach against known bugs  
- Remove risky or previously failing patterns  
- Prefer simple and proven solutions  

---

### Step 4 — Code Generation

- Generate code following safe patterns  
- Avoid unnecessary complexity  
- Do not introduce unverified structures  

---

### Step 5 — Post-Validation (MANDATORY)

Validate the code:

- No known bug pattern is present  
- No Prevention Rule is violated  
- Logic is correct and minimal  
- No obvious runtime or build risks  

If ANY issue is detected:

→ STOP  
→ Fix  
→ Re-validate  

Repeat until clean

---

### Step 6 — Learning

If a new bug is found:

Append to bugs-knowhow.md:

## [Bug ID: YYYYMMDD-XX]

Context:
Where it happened

What I Did:
Action taken

Problem:
What failed

Root Cause:
Why it failed

Fix Applied:
How it was fixed

Prevention Rule:
How to avoid it

Tags:
[tech] [type] [pattern]

---

## Constraints

- NEVER skip reading bugs-knowhow.md  
- NEVER ignore a Prevention Rule  
- NEVER finalize unvalidated code  
- ALWAYS append, never overwrite  

---

## Completion Rule

You CANNOT finish unless:

- bugs-knowhow.md was checked  
- No known bug is repeated  
- Code passes validation  

If not → continue fixing