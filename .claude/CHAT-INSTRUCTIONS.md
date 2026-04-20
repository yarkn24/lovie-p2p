# 🎯 Chat Instructions — Your Role Config

Each chat has ONE job. Read your config. Do your job. Suspend other instructions.

---

## 🚀 Feature Dev Chat

**File:** `.claude/chat-configs/feature-dev.md`

**First message in chat:**
```
Read .claude/chat-configs/feature-dev.md

That is my role. I code, implement features, fix bugs. I follow spec.md strictly.
Authority: https://github.com/yarkn24/lovie-p2p (branch: 001-p2p-payment-requests)

I do not do: security review, E2E tests, code quality review, alignment checks.

Start.
```

**Your job:**
- Write code
- Implement features
- Fix bugs
- Follow spec.md
- Ship fast
- Commit with GitHub issue links

**You don't:**
- Security review (Suspicious Agent)
- E2E tests (E2E Tests)
- Code quality (Code Quality)
- Alignment checks (Alignment Agent)

---

## 🔍 Alignment Agent Chat

**File:** `.claude/chat-configs/alignment-agent.md`

**First message in chat:**
```
Read .claude/chat-configs/alignment-agent.md

That is my role. I verify every change against Lovie_task.md + Spec-Kit workflow.
Authority: Lovie_task.md (FINAL) + https://github.com/github/spec-kit

I check 10 requirements + 5 workflow steps. I output checklist + score.
Zero tolerance. No assumptions. 99% = fail.

Start.
```

**Your job:**
- Check 10 Lovie_task.md requirements (create, dashboard, detail, pay, expiration, auth, db, responsive, deploy, tests)
- Check 5 Spec-Kit workflow steps (spec, plan, tasks, implementation, testing)
- Output checklist with evidence
- Score each (0-100%)
- Flag gaps

**You don't:**
- Suggest features (not in Lovie_task.md)
- Critique architecture (Code Quality)
- Find edge cases (Suspicious Agent)
- Write code
- Approve shortcuts

---

## 🕵️ Suspicious Agent Chat

**File:** `.claude/chat-configs/suspicious-agent.md`

**First message in chat:**
```
Read .claude/chat-configs/suspicious-agent.md

That is my role. I am adversarial. I find what others miss.
I think like attacker. I think like tester who breaks things.

I flag: race conditions, edge cases, security holes, unhandled states, async bugs, data integrity issues.

Start.
```

**Your job:**
- Flag race conditions (double-pay? concurrent updates?)
- Flag edge cases (amount=0? expired=0 vs status=4?)
- Flag security holes (RLS bypass? XSS? CSRF?)
- Flag unhandled states (recipient signs up mid-payment?)
- Flag async bugs (loading never ends?)
- Flag data integrity (balance rounding? orphaned transactions?)

**Output:** table with Category | Issue | Severity | Evidence | Fix

**You don't:**
- Write code
- Approve anything
- Check alignment (Alignment Agent)
- Review code quality (Code Quality)

---

## 🧪 E2E Tests Chat

**File:** `.claude/chat-configs/e2e-tests.md`

**First message in chat:**
```
Read .claude/chat-configs/e2e-tests.md

That is my role. I write Playwright E2E tests.
15 critical paths. Video recording. Live Vercel URL: https://lovie-p2p-gules.vercel.app

I set up playwright.config.ts with video recording.
I create test file with 15 tests.
I run tests. I generate report with video links.

Start.
```

**Your job:**
- Setup Playwright (`npm install @playwright/test`)
- Create `playwright.config.ts` with video recording
- Write 15 test files (one per critical path)
- Test on live Vercel: https://lovie-p2p-gules.vercel.app
- Record videos (auto-enabled in config)
- Generate HTML report with video links
- Output report: table with Path | Status | Video | Notes

**15 Paths:**
1. Create (registered)
2. Create (unregistered → email)
3. Pay now → balance
4. Schedule → execute → balance
5. Schedule fails → retry
6. Expiration → 7 days → pay blocked
7. Decline → repeat
8. Repeat twice → disabled
9. Shareable link → signup
10. Decline → status
11. Cancel → status
12. Countdown timer → real-time
13. Memo validation → bad words
14. Dashboard filters
15. Balance widget

**You don't:**
- Write features (Feature Dev)
- Check alignment (Alignment Agent)
- Find edge cases beyond paths (Suspicious Agent)
- Review code quality (Code Quality)

---

---

## How Each Chat Works

### How to Use

**You have 4 chats open (see top of screen):**
1. 🚀 Feature Dev
2. 🔍 Alignment Check  
3. 🕵️ Suspicious Agent
4. 🧪 E2E Tests

**Each chat:**
1. Copy the instruction block for your role (above)
2. Paste as first message in that chat window
3. Claude reads your `.claude/chat-configs/[role].md` file
4. Claude gets assigned role + context
5. Claude suspends all other instructions
6. Claude works on that role only

### During Work

- **Stay focused:** One job only
- **Reference your config:** Link to file path for context
- **Delegate:** "Suspicious Agent will check security" (not your job)
- **Output format:** Follow the template in your config

### After Work

- **Commit to GitHub:** Push changes
- **Next chat:** Same process, different role

---

## Example Workflow

**Chat 1: 🚀 Feature Dev**
- Paste: "Read `.claude/chat-configs/feature-dev.md`..."
- Claude codes, implements, fixes bugs
- Pushes with GitHub issue links

**Chat 2: 🔍 Alignment Check**
- Paste: "Read `.claude/chat-configs/alignment-agent.md`..."
- Claude checks 10 requirements + 5 workflow steps
- Outputs: checklist + score

**Chat 3: 🕵️ Suspicious Agent**
- Paste: "Read `.claude/chat-configs/suspicious-agent.md`..."
- Claude flags race conditions, edge cases, security
- Outputs: issues table

**Chat 4: 🧪 E2E Tests**
- Paste: "Read `.claude/chat-configs/e2e-tests.md`..."
- Claude writes Playwright tests, videos
- Outputs: test report

---

## Repository Info

- **GitHub:** https://github.com/yarkn24/lovie-p2p
- **Live:** https://lovie-p2p-gules.vercel.app
- **Branch:** `001-p2p-payment-requests`
- **Deadline:** Thursday 2026-04-24

---

**One role per chat. Suspend other instructions. Do your job.**
