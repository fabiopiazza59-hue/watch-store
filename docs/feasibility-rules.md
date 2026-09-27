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
| `date-window` | error | Dial has a date window but the movement cannot show a date there, or dial is day-date but movement is date-only. | The window would open onto bare movement (the NH38 has no date wheel), or its day half would stay blank. |
| `date-window` | warning | Dial has **no** window but the movement has a date wheel ("phantom date"); or a date-only dial on a day-date movement. | Works, but the crown has a setting position that does nothing visible. |
| `dial-center-hole` | error | Dial centre hole < the movement's outermost hand pinion (GMT pinion if any, else hour) + 0.5 mm. In practice: an NH34 (2.20 mm GMT pinion) needs an NH34-ready dial of ≥ 2.7 mm; standard NH dials are ≈ 2.05 mm. | The dial would bind on the 24h wheel pipe and not sit flat; it would have to be broached. |
| `hand-fit` | error | Any hand hole (hour/minute/seconds) differs from the movement's pinion size by more than 0.02 mm. | Hands would be loose or impossible to press on. |
| `gmt-hand` | error | GMT movement without a GMT hand in the hand set, or a GMT hand set on a movement without a GMT pinion (or GMT hole size mismatch > 0.02 mm). | Missing function / hand cannot be fitted. |
| `hand-length` | error | Minute or seconds hand longer than the dial radius − 0.3 mm. | Hand tip would foul the chapter ring / case. |
| `hand-length` | warning | Minute hand shorter than 75 % of the dial radius. | Looks undersized and is hard to read against the minute track. |
| `crystal-fit` | error | \|crystal diameter − case crystal seat\| > 0.05 mm. Crystals are sold in 0.1 mm steps, so only the seat's own nominal size passes. | A crystal one 0.1 mm step off won't press in or won't seal. |
| `bezel-insert` | error | Case has an insert bezel (`unidirectional-120` or `bidirectional-24h`) but no insert selected; insert outer/inner diameters differ from the case's insert seat by > 0.1 mm; or an insert is selected for a case without an insert bezel. | Insert won't fit, or there's nowhere to fit it. |
| `bezel-scale` | warning | 24h bezel with a non-24h insert, or a 24h insert on a 120-click dive bezel; or a GMT movement with no 24h scale on either dial or insert. | Scale won't match the bezel action / the GMT hand has nothing to be read against. |
| `strap-width` | error | Strap width ≠ case lug width; or a bracelet with fitted end links that doesn't list this case. | Strap won't fit between the lugs. |
| `hand-clearance` | warning | 4-hand (GMT) stack in a case whose hand clearance is < 1.6 mm. | Tight stack: hands may touch each other or the crystal; needs careful fitting. |
| `hand-clearance` | warning | GMT movement in a case not sold NH34-ready with the chosen crystal's shape (`WatchCase.nh34ReadyCrystals`), and a seconds hand of ≥ 12 mm under a flat or single-domed crystal, or > 12.5 mm under a double-dome. | The NH34 lifts the hand stack about 0.4 mm; in a case made for three-hand movements a long seconds hand can brush the crystal and stop the watch (Lucius Atelier's NH34 clearance table; one case maker's "under 12 mm" advice). |
| `dial-text` | error | Custom dial text on a non-printable dial; longer than 20 chars; characters outside letters, digits, space and `. , ' & -`; contains another watch brand's name; contains a protected geographic indication ("Swiss", "Swiss Made", "Genève/Geneva"). | Can't print it / trademark infringement / NH-movement watches don't qualify for Swiss indications. |
| `dial-text` | warning | The text fits between the dial's hour markers only below 65 % of its full print size (the smallest legible size, a cap height of about 0.5 mm on a 28.5 mm dial). Measured with the preview's own layout (`src/domain/dialTextFit.ts`): markers, numerals and lume dots, minute track or chapter ring, 24h scale. On our dials that is about 14-19 characters. | It would print too small to read, or run into the markers. |
| `caseback-engraving` | error | Engraving on a display (exhibition) caseback; longer than 60 chars; disallowed characters (same set as dial text); brand names or Swiss indications. | Can't laser-engrave glass on this setup / legal reasons. |
| `spare-strap` | error | The spare strap (`extras.spareStrapId`) is an unknown id or not a strap; its width ≠ the case lug width; or it's a bracelet with fitted end links that doesn't list this case. | It wouldn't fit the watch it comes with. |
| `spare-strap` | info | The spare strap is the same strap the watch is fitted with. | Two identical straps: a replacement, but no change of look. |
| `extras` | error | An add-on id in `extras.itemIds` that isn't in the extras catalogue (`catalog/extras.ts`), or one listed more than once. | Nothing to supply / each add-on comes once per order. |
| `lume-match` | info | Dial and hands both lumed but with different lume colours. | They glow differently in the dark. |
| `crystal-material` | info | Mineral crystal on a case rated ≥ 200 m. | Sapphire is recommended for a tool/dive watch. |
| `style-coherence` | info | Dial style differs from case style (e.g. dress dial in a dive case). | Taste only — allowed. |

Text checks normalise case, accents, spacing and Unicode compatibility forms, so "rolex", "Rolex",
"R O L E X" and fullwidth "ＲＯＬＥＸ" are caught ("R0LEX"-style look-alike tricks are out of scope).
Compatibility forms (fullwidth letters, ligatures such as "ﬁ", superscripts) are also refused as
characters, because they would be printed as typed. The brand blocklist lives in `src/domain/rules/`.

Customer text should pass through `normalizePersonalizationText` wherever it enters a spec (the
configurator, the designer, order creation): it turns the typographic apostrophes and dashes that
phones type (’ ‘ ʼ ′ and ‐ – — −) into `'` and `-`. The rules themselves stay strict, so text that
skipped the clean-up is still reported.

`evaluateOptions(slot, spec)` swaps each candidate part into the spec, re-validates, and reports the
issues that involve that slot; a candidate is `compatible` when none of those issues is an error.
For the optional `bezelInsertId` slot the first option has id `NONE_OPTION_ID` ("none") = no insert.

`repairSpec(spec)` repeatedly applies the first fix of the first fixable error until the spec is
buildable, no fix applies, or it would revisit a previous spec (cycle guard, max 12 steps).

`repairAround(spec, lockedSlots)` is the same loop, but it skips any fix that would change a locked
slot (the part a customer just chose) and takes the first fix of any error that leaves them alone.
`repairKeeping(spec, lockedSlots)` runs that first; if the design still can't be built it also tries
every part for the other slots of the first remaining error, and every template's parts in the
unlocked slots, repairing around each, and keeps the buildable result with the fewest changes plus
warnings. The configurator uses it for "Fix everything" and "Keep the … fix the rest", and to find
parts that "fit with changes".

## Extras

A spec's `extras` (a spare strap and add-ons such as a presentation box or fine regulation) are
optional: an absent field means none, as on designs and orders from before extras existed. Their
issues have `slots: []`, since extras aren't a slot, so they never show up in `evaluateOptions`.

Fixes set the whole `extras` object. A `spare-strap` issue offers up to three other straps that fit,
ranked by variety first (a different type from the main strap, since a spare is usually for a change
of look), then similarity to the spare chosen (type, colour), then price and catalogue order, never
the main strap itself; plus "Remove the spare strap". An `extras` issue offers removing the unknown
or repeated add-ons.

The extras follow the watch: a fix to the watch itself (a case with other lugs, say) is still
offered when it leaves the spare strap not fitting, and the spare strap's own fix then sorts that
out, which is what the repair loops above do next. `describeChanges` words extras changes as
"Spare strap: none → Olive NATO 20mm", "Added: Presentation box" and "Removed: Gift wrapping and card".

`evaluateSpareStraps(spec)` works like `evaluateOptions` for the spare strap: `NONE_OPTION_ID` first,
then every strap in catalogue order, each with the `spare-strap` errors and warnings choosing it would
cause. The identical-strap note is left out; compare the option with `spec.strapId` for that.
