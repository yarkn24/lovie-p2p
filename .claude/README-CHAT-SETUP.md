# Chat Setup Instructions

Lovie P2P uses vertical slicing across 4 specialized chats.

## How to Use

1. **Open new Claude Code session**
2. **Select chat role below**
3. **Copy the system prompt from the file**
4. **Paste into Claude's system prompt input** (if available)
5. Or just reference the file path in your message

## Chat Roles

### 🚀 Feature Developer
**File:** `.claude/system-prompts/feature-dev.md`

Use this when: Writing code, implementing features, fixing bugs

```
Read .claude/system-prompts/feature-dev.md and that's your job.
```

---

### 🔍 Alignment Check + 🕵️ Suspicious Agent
**File:** `.claude/system-prompts/alignment-check.md`

Use this when: Verifying requirements, checking for edge cases, security issues

```
Read .claude/system-prompts/alignment-check.md and that's your job.
```

---

### 🧪 E2E Tests Engineer
**File:** `.claude/system-prompts/e2e-tests.md`

Use this when: Writing Playwright tests, recording videos, generating test reports

```
Read .claude/system-prompts/e2e-tests.md and that's your job.
```

---

### 💎 Code Quality Guardian
**File:** `.claude/system-prompts/code-quality.md`

Use this when: Reviewing commits, validating architecture, flagging tech debt

```
Read .claude/system-prompts/code-quality.md and that's your job.
```

---

## Repository Info

- **GitHub:** https://github.com/yarkn24/lovie-p2p
- **Live URL:** https://lovie-p2p-gules.vercel.app
- **Branch:** `001-p2p-payment-requests`
- **Assignment:** `Lovie_task.md`
- **Spec:** `.specify/specs/p2p-payment-requests/spec.md`
- **Status:** 95% complete (E2E tests remaining)

---

## Workflow Example

```
Session 1 (🚀 Feature Dev):
  User: "Add balance history page"
  Claude: Writes code, pushes branch

Session 2 (🔍 Alignment Check):
  User: "Check if we're on track with assignment"
  Claude: Verifies + flags issues

Session 3 (🧪 E2E Tests):
  User: "Write tests for payment flow"
  Claude: Playwright + video + report

Session 4 (💎 Code Quality):
  User: "Review latest commits"
  Claude: Architecture review + refactor suggestions
```

---

## Pro Tips

- Each chat has ONE job → stay focused
- No code changes in Alignment/E2E/Quality chats
- Feature Dev chat pushes code, others review
- Use `.specify/specs/` for architecture questions
- Verify against `Lovie_task.md` before shipping
