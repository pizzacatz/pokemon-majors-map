// Fixtures for parseRegOpens — the only genuinely fragile piece of the RK9
// scrape. Run with: npm test (or node scraper/parse-test.mjs).
import { parseRegOpens } from './scrape.mjs'

// Freeze "now" so year inference is deterministic.
const NOW = new Date('2026-07-30T12:00:00Z')

const CASES = [
  // The four real formats live on rk9.gg as of 2026-07-30.
  ['Registration opens August 5 at 7:00 pm EDT', '2027-04-10', '2026-08-05T19:00:00-04:00'],
  ['Registration opens August 5 at 19:00 CEST', '2027-04-24', '2026-08-05T19:00:00+02:00'],
  ['Registration opens August 5 at 7:00 pm AEST', '2027-05-29', '2026-08-05T19:00:00+10:00'],
  ['Registration opens August 5 at 7:00 pm BRT', '2027-05-08', '2026-08-05T19:00:00-03:00'],
  // Embedded in a full table row.
  [
    '2027 Baltimore Regional | September 18-20, 2026 | Registration opens August 5 at 7:00 pm EDT | Baltimore, MD',
    '2026-09-18',
    '2026-08-05T19:00:00-04:00',
  ],
  // Explicit year wins over inference.
  ['Registration opens August 5, 2027 at 7:00 pm EDT', null, '2027-08-05T19:00:00-04:00'],
  // Abbreviated month, no minutes, noon/midnight handling.
  ['Registration opens Aug. 5 at 7 pm EDT', '2026-12-01', '2026-08-05T19:00:00-04:00'],
  ['Registration opens August 5 at 12 pm EDT', '2026-12-01', '2026-08-05T12:00:00-04:00'],
  ['Registration opens August 5 at 12:30 am EDT', '2026-12-01', '2026-08-05T00:30:00-04:00'],
  // Year rolls forward: a January date scraped in July must land next year.
  ['Registration opens January 5 at 7:00 pm EST', '2027-04-10', '2027-01-05T19:00:00-05:00'],
  // Year rolls back: a late-December open scraped just after New Year.
  [
    'Registration opens December 30 at 7:00 pm EST',
    '2026-03-01',
    '2025-12-30T19:00:00-05:00',
    new Date('2026-01-02T12:00:00Z'),
  ],
  // Refusals: unknown timezone, missing timezone, no announcement at all.
  ['Registration opens August 5 at 7:00 pm XYZ', '2027-04-10', null],
  ['Registration opens August 5 at 7:00 pm', '2027-04-10', null],
  ['Registration is open to qualified, invited competitors', '2026-08-28', null],
  ['September 18-20, 2026 | Baltimore, MD', '2026-09-18', null],
]

let failed = 0
for (const [text, startDate, expected, now = NOW] of CASES) {
  const got = parseRegOpens(text, startDate, now)
  if (got !== expected) {
    failed++
    console.error(`FAIL: ${JSON.stringify(text)}\n  expected ${expected}\n  got      ${got}`)
  }
}
if (failed) {
  console.error(`${failed}/${CASES.length} cases failed`)
  process.exit(1)
}
console.log(`parse-test: ${CASES.length} cases passed`)
