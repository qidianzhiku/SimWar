# W027 Acceptance Matrix

The matrix freezes the corrected topology before product review. `Quality &
Risk` rows are intentionally owned by `COO`; there is no standalone role slot.

| ID     | Requirement                           | Evidence target                   |
| ------ | ------------------------------------- | --------------------------------- |
| W27-01 | Configurable roster                   | `w027-role-roster.v1`             |
| W27-02 | Five formal roles                     | `W027_FORMAL_ROLE_KEYS`           |
| W27-03 | CEO context                           | decision-right policy             |
| W27-04 | COO quality/risk private judgment     | `kind=risk`, `COO`                |
| W27-05 | CFO context                           | decision-right policy             |
| W27-06 | CMO context                           | decision-right policy             |
| W27-07 | COO operations context                | operational capabilities          |
| W27-08 | CHRO context                          | decision-right policy             |
| W27-09 | Legacy `risk` compatibility           | maps to `COO`                     |
| W27-10 | Legacy `Quality & Risk` compatibility | maps to `COO`                     |
| W27-11 | No standalone Quality & Risk          | schema enum negative              |
| W27-12 | Role-private judgment write           | Student BFF                       |
| W27-13 | Judgment versioning                   | append-only version               |
| W27-14 | Judgment visibility                   | author-only statement             |
| W27-15 | Teacher metadata projection           | safe summary                      |
| W27-16 | Role position write                   | team-safe BFF                     |
| W27-17 | Actor identity exclusion              | Student safe projection           |
| W27-18 | Value divergence                      | V2 dimension                      |
| W27-19 | Assumption divergence                 | V2 dimension                      |
| W27-20 | Evidence divergence                   | V2 dimension                      |
| W27-21 | Risk divergence                       | V2 dimension                      |
| W27-22 | Tradeoff divergence                   | V2 dimension                      |
| W27-23 | Resolution source digest              | stale guard                       |
| W27-24 | Preserved dissent                     | resolution V2                     |
| W27-25 | Dissent trace stage                   | trace V2                          |
| W27-26 | Team-scoped storage                   | repository query                  |
| W27-27 | Tenant-scoped storage                 | repository query                  |
| W27-28 | Course/run/round scope                | repository query                  |
| W27-29 | Private payload rejection             | contract fixture                  |
| W27-30 | Bounded text fields                   | service validation                |
| W27-31 | Bounded reference lists               | service validation                |
| W27-32 | Decision-right policy                 | shared contract                   |
| W27-33 | COO quality controls                  | policy capabilities               |
| W27-34 | COO risk register                     | policy capabilities               |
| W27-35 | No canonical writer change            | existing role merge remains owner |
| W27-36 | No settlement mutation                | source audit and tests            |
| W27-37 | No replay mutation                    | source audit and tests            |
| W27-38 | Teacher-safe workbench                | Teacher panel                     |
| W27-39 | Student-safe workbench                | Student panel                     |
| W27-40 | Known limits visible                  | both projections                  |
