# Manual test — curriculum-driven reading passages

## Acceptance checklist

1. Select a Grade 10 TVET Auto Mechanics lesson plan about workplace safety.
2. Confirm generation loads NVQ-J / subject / grade / topic / standards / objectives / competencies / vocabulary from the saved plan (not PDF-only parsing).
3. Enable **Include reading passage**.
4. Set:
   - Passage Type: Scenario
   - Number of Passages: 7
   - Questions Per Passage: 1
   - Question Type: Multiple Choice
   - Passage Style: Realistic Workplace
   - Reading Level: On Grade
5. Generate and confirm loading copy: “Generating distinct curriculum-aligned passages…”
6. Confirm all seven scenarios are meaningfully different workshop/educational incidents.
7. Confirm output is **not** “Hazard/PPE/Risk Assessment/OSH in Practice” clones of the same instructor-stops-student story.
8. Confirm vocabulary appears naturally across the set.
9. Confirm every question is tied to its passage on the card front.
10. Confirm card total = passages × questions per passage (+ any regular cards).
11. Confirm cards save successfully.
12. Confirm the selected lesson plan remains linked for the save destination.
13. Repeat with Mathematics, Science, English Language Arts, and History lesson plans.
14. Confirm the same architecture adapts without subject-specific hardcoding.

## Notes

- No database migration is required; passage metadata is carried in review/explanation fields.
- Plan card limits still apply to the combined regular + passage card count.
