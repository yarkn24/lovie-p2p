#!/bin/bash
# Alignment Check Hook — Verify every change against Lovie_task.md + Spec-Kit
# Runs after: Write, Edit, Bash (git commits)
# Token-optimized: minimal output, quick checks

set -e

ASSIGNMENT_FILE="Lovie_task.md"
SPEC_FILE=".specify/specs/p2p-payment-requests/spec.md"
PLAN_FILE=".specify/specs/p2p-payment-requests/plan.md"
TASKS_FILE=".specify/specs/p2p-payment-requests/tasks.md"

# Check 1: Does assignment file exist?
if [ ! -f "$ASSIGNMENT_FILE" ]; then
  echo "⚠️ Alignment: Lovie_task.md not found"
  exit 0
fi

# Check 2: Are Spec-Kit artifacts present?
missing_specs=""
[ ! -f "$SPEC_FILE" ] && missing_specs="${missing_specs}spec.md "
[ ! -f "$PLAN_FILE" ] && missing_specs="${missing_specs}plan.md "
[ ! -f "$TASKS_FILE" ] && missing_specs="${missing_specs}tasks.md "

if [ -n "$missing_specs" ]; then
  echo "⚠️ Alignment: Missing Spec-Kit files: $missing_specs"
  exit 0
fi

# Check 3: 10 Lovie_task.md requirements present in implementation?
requirements=(
  "Request Creation Flow"
  "Request Management Dashboard"
  "Request Detail View"
  "Payment Fulfillment Simulation"
  "Request Expiration"
  "Authentication"
  "Data Persistence"
  "Responsive Design"
  "Deployment"
  "E2E Tests"
)

assignment_content=$(cat "$ASSIGNMENT_FILE")
found=0
missing=""

for req in "${requirements[@]}"; do
  if echo "$assignment_content" | grep -q "$req"; then
    ((found++))
  else
    missing="${missing}❌ $req\n"
  fi
done

score=$((found * 10))
echo "🔍 Alignment Check: $score% ($found/10 requirements found)"

if [ "$found" -lt 10 ]; then
  echo -e "Missing:\n$missing"
fi

# Check 4: Spec-Kit workflow steps?
spec_present=0
[ -f "$SPEC_FILE" ] && [ -s "$SPEC_FILE" ] && ((spec_present++))
[ -f "$PLAN_FILE" ] && [ -s "$PLAN_FILE" ] && ((spec_present++))
[ -f "$TASKS_FILE" ] && [ -s "$TASKS_FILE" ] && ((spec_present++))

workflow_score=$((spec_present * 33))
echo "📋 Spec-Kit: $workflow_score% ($spec_present/3 artifacts present)"

# Check 5: GitHub issues linked?
last_commit=$(git log -1 --pretty=%B 2>/dev/null | head -1 || echo "")
if echo "$last_commit" | grep -qi "closes\|fixes"; then
  echo "✅ Last commit links to GitHub issue"
else
  echo "⚠️ Last commit: no GitHub issue link (use 'Closes #123')"
fi

# Final score
total_score=$(( (found * 10 + spec_present * 20) / 5 ))
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$total_score" -ge 80 ]; then
  echo "✅ Alignment: $total_score% (ON TRACK)"
elif [ "$total_score" -ge 60 ]; then
  echo "⚠️  Alignment: $total_score% (CHECK GAPS)"
else
  echo "❌ Alignment: $total_score% (CRITICAL GAPS)"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
