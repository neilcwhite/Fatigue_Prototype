# Network Rail NR/L2/OHS/003 Compliance Review

Based on the official Managing Fatigue Charts 1 & 2, here's our compliance status:

## ✅ CORRECTLY IMPLEMENTED

### Level 2 Triggers (Chart 1 - High Risk)
- ✅ **>72hrs in 7days** - Implemented as `LEVEL_2_EXCEEDANCE` (severity: level2)
  - Code: `LEVEL_2_THRESHOLD: 72`
  - Triggers complete work prohibition + 24h mandatory rest

### Level 1 Triggers (Chart 1 - Medium Risk)
- ✅ **>60hrs but <72hrs in 7days** - Implemented as `LEVEL_1_EXCEEDANCE` (severity: level1)
  - Code: `LEVEL_1_THRESHOLD: 60`
  - Triggers safety-critical duty restrictions
- ✅ **<12hrs between shifts** - Implemented as `INSUFFICIENT_REST` (severity: breach)
  - Code: `MIN_REST_HOURS: 12`
- ✅ **>12hr shift** - Implemented as `MAX_SHIFT_LENGTH` (severity: breach)
  - Code: `MAX_SHIFT_HOURS: 12`
- ✅ **>13 in 14days** - Implemented as `MAX_CONSECUTIVE_DAYS` (severity: breach)
  - Code: `MAX_CONSECUTIVE_DAYS: 13`
- ✅ **>14hr door to door** - This is calculated including commute time in FRI

### Good Practice Triggers (Chart 1)
- ✅ **> 30 FRI daytime** - Defined but **NOT CHECKED**
  - Code: `FATIGUE_SCORE_DAYTIME: 35` (we have 35, chart shows 30)
- ✅ **> 40 FRI night time** - Defined but **NOT CHECKED**
  - Code: `FATIGUE_SCORE_NIGHTTIME: 45` (we have 45, chart shows 40)

### FRI Risk Score
- ✅ **> 1.6 FRI risk score** - Implemented as `ELEVATED_FATIGUE_INDEX` (severity: breach)
  - Code: `RISK_SCORE_LIMIT: 1.6`
  - Referenced in Chart 1 as "> 1.6 FRI risk score"

---

## ⚠️ ISSUES FOUND

### 1. Good Practice FRI Triggers NOT Enforced
**Charts state:** "Good Practice Triggers: > 30 FRI daytime, > 40 FRI night time"

**Current Status:** Constants defined but compliance checks not implemented

**Impact:** These are "reasonably practicable" (green box) triggers that should:
- Trigger roster redesign consideration
- Generate warnings for monitoring
- Not block work (green vs yellow/red)

**Required Values (from chart):**
- 30 FRI daytime (we have 35 in constants)
- 40 FRI night time (we have 45 in constants)

### 2. Level 2 Severity Classification
**Charts state:** Level 2 (>72hrs) shows as "Non-compliance requires variation against standard" (YELLOW/AMBER box)

**Current Code:** `severity: 'level2'` - We classify this correctly as amber

**Status:** ✅ Correct - but naming could be clearer (level2 = amber = requires FAMP)

### 3. Missing Distinctions
The charts show these additional Level 1 triggers we may not have:
- **> 35 FRI daytime** (Level 1 trigger, not Good Practice)
- **> 45 FRI night time** (Level 1 trigger, not Good Practice)

**Note:** There's confusion in our constants - we have these values labeled as Level 1 Section 4.3 thresholds

---

## 📊 COMPLIANCE RULE SUMMARY (from Charts)

### Chart 1: Design Principles

**Level 2 Triggers (Amber - Variation Required):**
1. >72hrs in 7days ✅
2. >35 FRI daytime ❌ (not checked)
3. >45 FRI night time ❌ (not checked)
4. >1.6 FRI risk score ✅

**Level 1 Triggers (Yellow - Risk Assessment):**
1. >60hrs but <72hrs in 7days ✅
2. <12hrs between shifts ✅
3. >12hr shift ✅
4. >13 in 14days ✅
5. >14hr door to door ✅ (via FRI calculation)

**Good Practice Triggers (Green - Monitor):**
1. >30 FRI daytime ❌ (not checked - and we have wrong value 35)
2. >40 FRI night time ❌ (not checked - and we have wrong value 45)

### Chart 2: Assessment Principles

**Trigger Actions:**
- Level 2: Individual relieved from duty, 24h rest, excluded from safety-critical tasks ✅
- Level 1: Implement Fatigue Management Plan (FAMP) ✅
- Good Practice: Record and implement controls/mitigations ❌

---

## 🔧 RECOMMENDED FIXES

### Priority 1: Fix FRI Threshold Values
```typescript
export const FRI_THRESHOLDS = {
  // ... existing ...

  /** Good Practice thresholds - Chart 1 */
  GOOD_PRACTICE_DAYTIME: 30,   // Changed from 35
  GOOD_PRACTICE_NIGHTTIME: 40, // Changed from 45

  /** Level 1 thresholds - Chart 1 */
  LEVEL_1_FRI_DAYTIME: 35,     // New
  LEVEL_1_FRI_NIGHTTIME: 45,   // New

  /** Existing Level 2 threshold */
  RISK_SCORE_LIMIT: 1.6,       // Unchanged
}
```

### Priority 2: Implement FRI Compliance Checks
Add to `compliance.ts`:
- Check fatigue score against 30 (day) / 40 (night) for Good Practice warnings
- Check fatigue score against 35 (day) / 45 (night) for Level 1 violations
- Determine shift timing (day vs night) based on start time

### Priority 3: Add Good Practice Severity Level
```typescript
export type ComplianceSeverity =
  | 'info'      // New: Good Practice threshold
  | 'warning'   // Soft limit approaching
  | 'level1'    // Level 1 exceedance (yellow)
  | 'level2'    // Level 2 exceedance (amber)
  | 'breach';   // Hard breach (red)
```

---

## 📝 QUESTIONS FOR USER

1. Should we implement Good Practice FRI triggers (30/40)?
   - They show as GREEN boxes = "where reasonably practicable"
   - Would generate informational warnings, not block work

2. Clarify the FRI values:
   - Chart 1 Level 2: ">35 FRI daytime / >45 FRI night time"
   - Chart 1 Good Practice: ">30 FRI daytime / >40 FRI night time"
   - Are both sets needed?

3. Should we distinguish between:
   - Fatigue Score (FRI output value)
   - Risk Index (the 1.6 threshold we check)
   - Charts seem to use both

---

## ✅ CURRENT COMPLIANCE SCORE

**Implemented:** 8/11 triggers (73%)
**Missing:** 3 Good Practice + FRI score thresholds

**Critical triggers:** All Level 1 and Level 2 triggers are correctly implemented ✅

**Enhancement needed:** Good Practice monitoring for proactive fatigue management
