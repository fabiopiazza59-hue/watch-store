# Parts research: NH3x movements and the aftermarket parts around them

This document backs the numbers in `src/domain/catalog/`. Accurate dimensions are what let the
configurator honestly say "this will fit". So for every value it records where it came from, how
far to trust it, and what to confirm with a supplier before the first real orders.

Research date: September 2026. Prices move a lot, so re-check them before quoting customers.

## How to read the confidence levels

| Level | Meaning | What to do |
|---|---|---|
| **Verified** | Published by the manufacturer, or several independent sellers agree. | Use as-is. |
| **Single source** | One seller's product page. Plausible, not cross-checked. | Confirm when you place the first order. |
| **Estimate** | No published figure found; picked to be realistic. The part carries `dataNotes`. | Measure or ask the supplier **before** selling that part. |

## 1. Movements (Seiko Instruments / TMI "NH3x" family)

All four calibres share the same base movement. Case fit, dial feet, stem, rotor and hand pinions are
common; only the dial-side complication differs.

| Spec | NH35A | NH36A | NH34A | NH38A | Confidence |
|---|---|---|---|---|---|
| Diameter | 27.40 mm | 27.40 mm | 27.40 mm | 27.40 mm | Verified |
| Casing diameter (with dial-holding spacer) | 29.36 mm | 29.36 mm | 29.36 mm | 29.36 mm | Verified |
| Height | 5.32 mm | 5.32 mm | 5.32 mm | 5.32 mm | Verified |
| Height incl. cannon pinion | 7.55 mm | ≈7.55 mm | ≈7.95-7.99 mm (+0.4 mm GMT pinion) | ≈7.55 mm | Verified (NH35/NH34) |
| Jewels / beat rate | 24 / 21,600 vph (3 Hz) | same | same | same | Verified |
| Power reserve | 41 h | 41 h | 41 h | 41 h | Verified |
| Accuracy (factory spec) | −20 to +40 s/day | same | same | same | Verified |
| Lift angle (for the timegrapher) | 53° | 53° | 53° (one source says 54°) | 53° | Verified |
| Hacking / hand-winding | yes / yes | yes / yes | yes / yes | yes / yes | Verified |
| Hand holes H / M / S | 1.50 / 0.89 / 0.21 mm | same | same + **GMT 2.20 mm** | same | Verified |
| Display | Date at 3 | Day + date at 3 | Date at 3 + 24h hand | None (true no-date) | Verified |

**Hand-hole notation.** Seiko writes hand sizes as "150/89/21" (hundredths of a millimetre).
Aftermarket hands are usually sold as 1.50 / 0.90 / 0.20 mm. The catalogue keeps both: the
movement carries Seiko's figures and the hands carry the sellers' figures. The rules engine's
0.02 mm tolerance accepts the pair, which is how it works on the bench.

**Things that matter at the bench:**

- **NH35A date disc and crown position.** The same date disc works in 3 o'clock, 3.8 o'clock
  (SKX-style "4 o'clock") and about 4.1 o'clock crown cases. A dial whose window is at a *true*
  4 o'clock needs a different date disc. NH35 variants with the date at 6 o'clock also exist; they
  are not stocked here. *Verified (seller listing; forum discussions agree).*
- **NH36A day wheel.** The day wheel is pre-aligned for one crown position. Sellers stock a standard
  version (3 o'clock crown) and a "4 o'clock crown" version. Order the one that matches the case,
  or the day text reads crooked. *Verified* (SII's NH3 technical guide lists the day star by crown
  position). The build sheet's parts list names the day wheel for the chosen case, and the black or
  white date wheel that suits the dial (the same rule the preview draws with).
- **Quick-set windows.** SII's NH3 technical guide: don't set the date between 9 p.m. and 4 a.m. on
  the NH35/NH36, or the calendar can malfunction. The NH34 isn't in that guide; Seiko's NH34
  instructions say not to change the date *or the GMT hand* between 9 p.m. and 3 a.m. The build sheet
  uses these windows and does every quick-set test at about 6 o'clock. *Verified.*
- **Timing conditions.** SII measures a movement fully wound (at least 55 turns of the crown), 10-60
  minutes after winding, dial up, 9 o'clock up and 6 o'clock up, and allows a posture difference of
  under 60 s/day between them. The build sheet's baseline, regulation and QC use those conditions.
  *Verified.*
- **NH34A is a "caller" GMT.** Crown position 1 sets the date one way and moves the 24h hand in
  one-hour jumps the other way. The local hour hand is not independently settable. *Verified.*
- **NH34A needs a GMT dial.** The 24h pinion needs a dial centre hole of about 2.7-2.9 mm. Standard
  NH35 dials are about 2.05 mm and would have to be broached. Every GMT dial in the catalogue is
  sold NH34-ready. *Verified.* The rules engine checks this with `dial-center-hole` (`Dial.centerHoleMm`).
- **NH34A hand stack.** The stack is 0.4 mm taller, so the seconds hand can touch the crystal in a
  case made for three-hand movements. One case maker says the seconds hand must be under 12 mm, or
  use a seconds-hand cap. Lucius Atelier's table for an NH34 in a three-hand case: a flat crystal
  clears none of 12.0, 12.5 or 12.75 mm seconds hands; a double-dome clears 12.0 and 12.5 mm but not
  12.75 mm. *Verified.* The `hand-clearance` rule warns about exactly this (flat or single-domed
  crystal with a seconds hand of 12 mm or more, double-dome with one over 12.5 mm) unless the case
  maker sells the case NH34-ready with that crystal shape (`nh34ReadyCrystals`): the Dress 39's
  reference case is sold "NH34-Ready" with its double-dome, and the Travel GMT 40's cited maker lists
  NH34 compatibility with its flat sapphire. That second listing is a generic compatibility list, the
  kind the same maker also gives its dive cases (which are not marked), so check the seconds hand
  against the crystal on the first Travel GMT build. Both GMT hand sets stocked have 13 mm seconds
  hands. Separately, cases with an estimated hand clearance under 1.6 mm get a "tight stack" warning.
- **NH38A is a true no-date.** It has no date wheel, so the crown has no dead "phantom date"
  position. The main plate is open at 9 o'clock so an *open-heart* dial can show the balance; with a
  solid dial the opening is hidden. *Verified.* Open-heart dials are not stocked yet, because the
  rules cannot tell that they only make sense on an NH38 (see §5).
- **Stems.** The NH stem (Seiko part 351-200, tap 10) must be cut to length for each case. Budget
  a spare stem per build while learning; pricing counts it under consumables. *Verified.*

## 2. The aftermarket parts ecosystem

### Dials
- **28.5 mm is the standard NH dial.** It is the size nearly every SKX-style, dive, field and GMT
  case takes. *Verified.*
- **Wide-opening cases take 33-34 mm dials.** Examples are 39 mm vintage-pilot cases, titanium
  pilot/field cases and some dress cases. The catalogue uses 33.5 mm dials for these. They are
  physically incompatible with 28.5 mm cases, and 28.5 mm hands look short on them. *Verified.*
- **Crown position is set by the dial feet.** Dials are made for a 3 o'clock or a 3.8/4 o'clock
  crown. Many sellers ship dials with **four feet** and you snip the unused pair. The catalogue
  conservatively assigns each dial one crown position (see §5). *Verified.*
- **Typical price** is €20-45 excl. VAT (for example, S$49 ≈ €33 for a branded-shop dial). *Verified.*

### Crystals (the case seat decides the diameter)
| Case pattern | Crystal | Confidence |
|---|---|---|
| SKX-style 42 mm (and SSK-style GMT) | 31.5 mm. Flat sapphire is about 2.9-3.0 mm thick; double-dome is about 4.5-4.7 mm overall. | Verified |
| 36-39 mm field / "GS-style" / 34 mm pilot NH cases | 29.5 mm. Flat 29.5 × 1.5 mm; double-dome 29.5 × 1.5 × 3 mm. | Verified (one maker, several cases) |
| SKX013-style 38 mm | 28.0 mm | Verified (not stocked) |
| 40 mm dive/GMT pattern (`case-gmt-40`, `case-diver-bronze-40`) | **30.5 mm** | Estimate |
| 39 mm vintage diver (`case-diver-39`) | **30.0 mm** domed | Estimate |
| 39 mm wide-dial pilot and titanium field | **34.5 mm** | Estimate |

Crystals cost about €18-25 for flat sapphire and €30-45 for double-dome. Mineral crystals cost
under €10. Case makers usually ship the case with the crystal fitted. Crystals are sold in 0.1 mm
steps and one step off won't seal, so the `crystal-fit` rule only accepts the seat's own size.
A domed or double-dome crystal is pressed with a hollow (ring) die that bears on its edge, never on
the dome (Esslinger's guide); the build sheet says so and adds the die to the tools.

### Bezel inserts
| Pattern | Outer × inner | Confidence |
|---|---|---|
| SKX-style, **sloped** | 38.0 × 30.6 mm (also sold as 38 × 30.5) | Verified |
| SKX-style, **flat** | 38.0 × 31.5-31.7 mm (needs a flat-insert bezel) | Verified (not stocked) |
| 40 mm dive/GMT and bronze patterns | 38.0 × 30.6 mm, the same inserts as sloped SKX | Verified (several listings) |
| 39 mm vintage diver | 36.5 × 30.5 mm | Single source |
| SKX013-style | 33.7 × 27.5 mm | Verified (not stocked) |
| Turtle-style | 39.1 × 32.5 mm | Verified (not stocked) |

Because the SKX-style and 40 mm patterns share inserts, the catalogue's 38 mm inserts fit three
cases. The 36.5 mm inserts fit only the compact diver. That is a real, physical incompatibility.

Prices: aluminium inserts cost €10-20 and ceramic €30-40 (for example, US$36 for a flat ceramic
SKX insert, S$60 for branded ceramic). *Verified.*

**Naming.** Colour combinations are described plainly ("GMT 24 Blue/Red"). Well-known nicknames for
two-tone bezels, and bracelet names like "Oyster" or "Jubilee", are other companies' trademarks, so
they are never used in part names.

### Hands
- **Lengths for 28.5 mm dials:** hour 8-9 mm, minute 11.5-13 mm, seconds 12.5-13.5 mm. Examples:
  8.5 / 12 / 12.5 and 8 / 11.5 / 12.5 mm. *Verified.* Against the rules, a minute or seconds hand
  may be at most 13.95 mm on a 28.5 mm dial, and a minute hand shorter than 10.7 mm looks undersized.
- **Lengths for 33.5 mm dials:** the catalogue assumes about 10.5 / 15-15.5 / 16 mm. *Estimate.*
  These hands would foul the chapter ring on a 28.5 mm dial, which is a real error.
- **GMT hands** for the NH34 have a 2.20 mm hole and are 8-12 mm long. *Verified.*
- **Price:** €10-30 a set (for example, S$38 ≈ €26 at a branded shop). GMT sets cost a little more.

### Cases
| Catalogue case | Modelled on | Key facts | Confidence |
|---|---|---|---|
| Classic Diver 42 | SKX-style aftermarket case | 42 mm, 46 mm lug-to-lug, 22 mm lugs, 3.8 crown, 28.5 dial, 31.5 crystal, 38 × 30.6 insert, 200 m | Verified |
| Black Sport 42 | Same pattern, PVD, fixed bezel | As above, fixed bezel | Single source (bezel variant) |
| Compact Diver 39 | 39 mm vintage-diver pattern | 20 mm lugs, 3 crown, 28.5 dial, 36.5 × 30.5 insert; the maker's spec says 5 ATM / 50 m and its title 10 ATM, so 50 m is used | Single source + estimates; WR unconfirmed |
| Field 38 | 36/39 mm field pattern | 20 mm lugs, 28.5 dial, 29.5 × 1.5 flat sapphire, 100 m | Interpolated |
| Dress 39 Exhibition | "GS-style" 39 mm | 20 mm lugs, 28.5 dial, 29.5 double-dome sapphire, display back; WR set conservatively to 50 m | Verified dimensions, WR estimate |
| Pilot 39 | 39 mm vintage-pilot pattern | 48.5 mm lug-to-lug, 12.7 mm thick, 20 mm lugs, 33.5 dial; no WR published, 50 m used | Verified dimensions; crystal estimated, WR unconfirmed |
| Travel GMT 40 | 40 mm dive/GMT pattern with bidirectional bezel | 20 mm lugs, 28.5 dial, 38 × 30.6 insert, 200 m, maker lists NH34 | Estimate (bezel action and crystal): the cited 40 mm case has a one-way 120-click bezel |
| Titanium Field 39 | Ti-2 pilot/field pattern | 48.6 mm lug-to-lug, 12 mm thick, 20 mm lugs, 33-34 dial, 200 m | Verified, crystal estimated |
| Bronze Diver 40 | CuSn8 40 mm dive pattern | 47.2 mm lug-to-lug, 13.5 mm thick, 20 mm lugs, 3 crown, 38 × 30.6 insert, 200 m | Verified, crystal estimated |

- **Water resistance:** a display caseback often drops the rating (for example, 200 m solid vs 100 m
  glass on the same case). Always quote the rating of the exact variant you order. Where a maker
  publishes no rating, or its figures disagree, the catalogue uses the lowest published figure (or a
  conservative 50 m) and sets `waterResistanceEstimated`, so the rating can be shown as unconfirmed
  and the build sheet never pressure-tests above it. A pressure test below the rating is not a pass.
- **Hand clearance** (`handClearanceMm`) is an estimate for every case. No maker publishes it.
  Thin cases (Field 38, Black Sport 42) are set below 1.6 mm, so an NH34 there gets the "tight
  stack" warning.
- **Case prices** are about €40-90 excl. VAT for steel, €80-130 for bronze or titanium, and more at
  premium shops. Lead times from Asian mod shops to the EU are 2-3 weeks.

### Straps
- The SKX-style pattern uses **22 mm** lugs. Nearly every 36-40 mm NH case uses **20 mm**.
- Bracelets with **solid (fitted) end links** only fit their own case pattern, so they list
  `compatibleCaseIds`. Straight-end bracelets and all straps are universal at the right width.
- Typical prices: NATO €10-15, FKM rubber €15-30, canvas €15-25, leather €25-60, fitted steel
  bracelet €40-80, titanium bracelet €60-100.

## 3. Prices used in the catalogue

These are estimated single-unit purchase costs in EUR excl. VAT, from reputable mod-part shops or
distributors. Observed retail prices are converted approximately.

| Part | Observed | Catalogue |
|---|---|---|
| NH35A | US$75-114 (US shops), S$135 (SG), €35-50 (marketplaces) | €55 |
| NH36A | US$75-85, S$100 | €58 |
| NH34A | US$110-168, S$190-200, €51-82 (marketplaces) | €95 |
| NH38A | US$87, S$190 | €70 |
| Steel case | US$18-73 (budget), S$120-240 (premium) | €40-70 |
| Bronze / titanium case | US$47-88 | €80-90 |
| Dial | S$49 | €24-40 |
| Hands | S$38 | €14-26 |
| Crystal | US$20-50 | €8-38 |
| Insert | US$10-36, S$60 | €10-34 |
| Strap / bracelet | see §2 | €12-70 |

Movement prices vary widely. Very cheap marketplace NH34s and NH35s are often grey-market or
refurbished, and the configurator promises genuine parts. A few orders at the catalogue prices
will show your real costs; then update `costEur`.

## 4. Before the first real orders: confirm with suppliers

1. **Crystal seats marked "Estimate"** (30.0, 30.5 and 34.5 mm cases): ask for the drawing or
   measure the fitted crystal. A 0.1 mm error means a crystal that won't seal.
2. **Compact Diver 39:** insert size (36.5 × 30.5?) and the water-resistance rating in writing. The
   cited page's spec says 5 ATM / 50 m while its title says 10 ATM; 50 m is used until then.
3. **Dress 39 Exhibition and Pilot 39:** the water-resistance rating of the exact variant (the
   display-back, push-pull Dress 39; the Pilot 39 has no published rating). Both use 50 m until then.
4. **Travel GMT 40:** a 40 mm NH34 case with a bidirectional 24-click bezel, its insert, crystal and
   rating. The 40 mm case cited so far has a one-way 120-click bezel, which would make the Travel GMT
   template's bezel promise (and its QC check) wrong.
5. **Wide-dial hands** (`hands-syringe-white-large`, `hands-sword-black-large`): the real lengths.
6. **NH36 builds in 3.8-crown cases:** order the "4 o'clock crown" day-wheel version (the build
   sheet's parts list says which).
7. **Hand clearance:** measure dial-to-crystal height in each case during the first build and
   replace the estimates. On the first NH34 build, check the 13 mm seconds hand against the crystal.

## 5. Real constraints the catalogue/rules cannot express yet

These are proposed as contract changes. Until then, `dataNotes` and `supplierHint` carry them.
(The dial centre hole, once listed here, is now modelled as `Dial.centerHoleMm` and checked by
the `dial-center-hole` rule.)

- **Movement day-wheel variant per crown position** (NH36). The build sheet works it out from the
  case, but the order doesn't record it as data.
- **Dials with feet for several crown positions** (a list instead of a single `crownPosition`).
- **Dial aperture** (open-heart at 9 o'clock), which only makes sense with the NH38.
- **Separate chapter rings.** Some premium cases need an SKX013-spec chapter ring bought separately.
  Our cases include the ring when they have one.

## Sources

Movements
- Caliber Corner, NH35A: https://calibercorner.com/seiko-caliber-nh35a/
- Caliber Corner, NH34: https://calibercorner.com/seiko-caliber-nh34/
- Caliber Corner, NH38A: https://calibercorner.com/seiko-sii-caliber-nh38a/
- Caliber Corner, NH36: https://calibercorner.com/seiko-caliber-nh36/
- namokiMODS, NH34 guide: https://www.namokimods.com/blogs/namokitimes/everything-you-need-to-know-about-the-seiko-gmt-nh34-movement
- HorologyBeats, NH34 guide: https://horologybeats.com/blogs/seiko-mod-guides/nh34-gmt-movement-guide
- Lucius Atelier, Seiko 5 GMT / NH34 compatibility: https://luciusatelier.com/blogs/news/compatibility-breakdown-of-seiko-5-gmt-series-nh34-movement
- Lucius Atelier, movements and prices: https://luciusatelier.com/collections/watch-movements
- Nomods, NH38 guide: https://nomods.co/blogs/seiko-mod-parts/seiko-nh38-movement-guide
- SII, Technical Guide & Parts Catalogue Cal. NH3 Series (2011; quick-set window, timing conditions, day star by crown position): https://myretrowatches.co.uk/wp-content/uploads/2022/02/Seiko-nh35.pdf
- Oceaneva, NH34 instructions (date and GMT-hand quick-set window): https://oceaneva.com/pages/nh34-instructions-manufactured-by-seiko-japan
- namokiMODS, NH36 day wheels by crown position: https://www.namokimods.com/blogs/namokitimes/how-to-change-day-wheels-seiko-nh36a
- Crystaltimes, NH35 (hand sizes, height with cannon pinion, fits 3 / 3.8 / 4.1 crown cases, price): https://usa.crystaltimes.net/shop/movements/nh35-movement-white-black-ct501/
- Watch-Modz, movement prices: https://watch-modz.com/product-category/movements/
- Tandorio, movement prices: https://tandoriowatch.com/collections/tmi-nh34-nh36etc

Dials, hands, inserts, crystals
- namokiMODS dial (28.5 mm, four feet): https://www.namokimods.com/products/watch-dial-milspec-type-i
- namokiMODS hands (lengths, price): https://www.namokimods.com/products/watch-hands-nautical-steel
- namokiMODS bezel insert sizes: https://www.namokimods.com/pages/seiko-bezel-insert-sizes
- Crystaltimes bezel insert sizes: https://usa.crystaltimes.net/seiko-bezel-insert-sizes/
- Crystaltimes flat ceramic SKX insert: https://usa.crystaltimes.net/shop/products/ct656-flat-ceramic-bezel-insert-skx007/
- Crystaltimes SKX crystals: https://usa.crystaltimes.net/product-category/skx007-mod-parts/skx007-sapphire-crystals/
- Long Island Watch, SKX flat sapphire (31.5 × 2.9 mm, US$45): https://longislandwatch.com/flat-sapphire-crystal-for-skx007-skx009-007-flat/
- Crystaltimes SKX013 crystal (28.0 × 2.8 mm): https://usa.crystaltimes.net/shop/products/ct044/
- Esslinger, pressing a domed gasket-fit crystal: https://blog.esslinger.com/how-to-press-a-domed-gasket-fit-watch-crystal-into-place-with-a-watch-crystal-press/

Cases
- Lucius Atelier, Explorer-pattern 39 mm case: https://luciusatelier.com/products/explorer-watch-case-v2-39mm
- Lucius Atelier, GS-pattern 39 mm case: https://luciusatelier.com/products/gs-watch-case-39mm-v2-nh34-ready
- Lucius Atelier, 34 mm pilot case: https://luciusatelier.com/products/pilot-watch-case-34mm-ultra-thin-edition
- Lucius Atelier, 42 mm SKX-pattern case: https://luciusatelier.com/products/diver-watch-case-42mm-skx007-submariner-edition-fits-nh-gmt-movements
- Lucius Atelier, case prices: https://luciusatelier.com/collections/watch-cases
- Tandorio, 40 mm dive case: https://tandoriowatch.com/products/40mm-sub-case-nh35-sliver-with-sapphire-crystal
- Tandorio, 39 mm vintage dive case: https://tandoriowatch.com/products/39mm-vintage-submariner-watch-case
- Tandorio, 39 mm vintage pilot case: https://tandoriowatch.com/products/39mm-vintage-pilot-case-33-5mm-dial
- Tandorio, 39.5 mm GS-pattern case: https://tandoriowatch.com/products/39-5mm-nh35-case-gs-case-mechanical-watch-case
- Tandorio, Ti-2 titanium case: https://tandoriowatch.com/products/ti-2-titanium-pilot-watch-case
- Tandorio, CuSn8 bronze case: https://tandoriowatch.com/products/40mm-cusn8-bronze-case
- Tandorio, 39 mm GMT case: https://tandoriowatch.com/products/39mm-exp-24-hour-gmt-watch-case-fixed-bezel
- Worn & Wound, SKX007 review (42.5 mm, 46 mm lug-to-lug, 13.25 mm, 22 mm lugs, crown at 4, 200 m): https://wornandwound.com/review/seiko-skx007-review/
