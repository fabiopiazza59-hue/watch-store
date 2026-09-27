# Feasibility rules

These are the rules the configurator uses to decide whether a design can actually be assembled.
They are implemented deterministically in `src/domain/rules/` — **the AI designer never decides
feasibility**, it only proposes designs that these rules then judge.

Severity levels:

- **error**: the watch cannot be assembled (or would be defective/illegal). Blocks ordering.
- **warning**: it can be built, but with a real functional downside the customer should accept knowingly.
- **info**: taste or good-to-know; never blocks.

Every issue names the `slots` it involves (so the UI can highlight pickers) and, where possible,
offers up to 3 `fixes`: concrete alternative parts from the catalogue that resolve that issue,
ranked by similarity to the current choice (same style/colour/type first, then cheaper).

| Rule id | Severity | Condition | Why it matters |
|---|---|---|---|
| `missing-part` | error | A required slot (movement, case, dial, hands, crystal, strap) is empty or references an unknown id / wrong category; or `bezelInsertId` is non-null but unknown. | Nothing to build. |
| `movement-family` | error | Case, dial or hands are made for a different movement family than the movement. | Dial feet, hand pinions and movement seat won't match. |
| `dial-size` | error | \|dial diameter − case dial seat diameter\| > 0.2 mm. | Dial won't seat: loose (rattles/rotates) or doesn't fit. |
| `dial-crown-position` | error | Dial's designed crown position ≠ case crown position (3 vs 3.8 vs 4 o'clock). | Dial feet/print are oriented for another crown position: the dial would sit rotated and the date window would not line up. |
| `date-window` | error | Dial has a date window but the movement cannot show a date there, or dial is day-date but movement is date-only. | The window would show a blank disc or a misaligned wheel. |
| `date-window` | warning | Dial has **no** window but the movement has a date wheel ("phantom date"); or a date-only dial on a day-date movement. | Works, but the crown has a setting position that does nothing visible. |
| `hand-fit` | error | Any hand hole (hour/minute/seconds) differs from the movement's pinion size by more than 0.02 mm. | Hands would be loose or impossible to press on. |
| `gmt-hand` | error | GMT movement without a GMT hand in the hand set, or a GMT hand set on a movement without a GMT pinion (or GMT hole size mismatch > 0.02 mm). | Missing function / hand cannot be fitted. |
| `hand-length` | error | Minute or seconds hand longer than the dial radius − 0.3 mm. | Hand tip would foul the chapter ring / case. |
| `hand-length` | warning | Minute hand shorter than 75 % of the dial radius. | Looks undersized and is hard to read against the minute track. |
| `crystal-fit` | error | \|crystal diameter − case crystal seat\| > 0.1 mm. | Crystal won't press in / won't seal. |
| `bezel-insert` | error | Case has an insert bezel (`unidirectional-120` or `bidirectional-24h`) but no insert selected; insert outer/inner diameters differ from the case's insert seat by > 0.1 mm; or an insert is selected for a case without an insert bezel. | Insert won't fit, or there's nowhere to fit it. |
| `bezel-scale` | warning | 24h bezel with a non-24h insert, or a 24h insert on a 120-click dive bezel; or a GMT movement with no 24h scale on either dial or insert. | Scale won't match the bezel action / the GMT hand has nothing to be read against. |
| `strap-width` | error | Strap width ≠ case lug width; or a bracelet with fitted end links that doesn't list this case. | Strap won't fit between the lugs. |
| `hand-clearance` | warning | 4-hand (GMT) stack in a case whose hand clearance is < 1.6 mm. | Tight stack: hands may touch each other or the crystal; needs careful fitting. |
| `dial-text` | error | Custom dial text on a non-printable dial; longer than 20 chars; characters outside letters, digits, space and `. , ' & -`; contains another watch brand's name; contains a protected geographic indication ("Swiss", "Swiss Made", "Genève/Geneva"). | Can't print it / trademark infringement / NH-movement watches don't qualify for Swiss indications. |
| `caseback-engraving` | error | Engraving on a display (exhibition) caseback; longer than 60 chars; disallowed characters (same set as dial text); brand names or Swiss indications. | Can't laser-engrave glass on this setup / legal reasons. |
| `lume-match` | info | Dial and hands both lumed but with different lume colours. | They glow differently in the dark. |
| `crystal-material` | info | Mineral crystal on a case rated ≥ 200 m. | Sapphire is recommended for a tool/dive watch. |
| `style-coherence` | info | Dial style differs from case style (e.g. dress dial in a dive case). | Taste only — allowed. |

Text checks normalise case, accents and spacing (so "R0LEX"-style tricks are out of scope, but
"rolex", "Rolex", "R O L E X" are caught). The brand blocklist lives in `src/domain/rules/`.

`evaluateOptions(slot, spec)` swaps each candidate part into the spec, re-validates, and reports the
issues that involve that slot; a candidate is `compatible` when none of those issues is an error.
For the optional `bezelInsertId` slot the first option has id `NONE_OPTION_ID` ("none") = no insert.

`repairSpec(spec)` repeatedly applies the first fix of the first fixable error until the spec is
buildable, no fix applies, or it would revisit a previous spec (cycle guard, max 12 steps).
