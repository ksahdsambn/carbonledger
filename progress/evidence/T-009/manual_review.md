# T-009 Manual Review Record — Golden Matching Cases (Group 3)

Reviewer: the executing AI developer (the only human-judgment step permitted by
the plan). Every case's best/runner-up pairing was re-examined against the
factor library entries. Opinions and resolved doubts are recorded below; no
unresolved objection remains.

## exact_match (MC-01..MC-08) — reviewed, no objections

All eight map a named material/utility to its exact primary factor: aluminium
sheet→aluminium primary; PET pellets→PET primary; grid electricity→UK
electricity; municipal water→water supply; PP crates→PP primary; polyester
fabric→clothing primary; glass bottles→glass primary; IT servers→electrical
items IT primary. Runner-ups are same-family alternatives (recycled variant or
adjacent material). Resolved doubt: MC-06 runner-up was originally "clothing
recycled open-loop" which does not exist in the source; corrected to the
existing "clothing re-used material" variant during build (predicate fix).

## boundary_inference (MC-09..MC-16) — reviewed, one realism caveat

- MC-09/MC-10: air factors with vs without radiative forcing — the boundary
  convention is the discriminator; matches PRD's intent that identical hauls
  can map to different boundaries.
- MC-11/MC-13: refrigerated vs non-refrigerated HGV average rigid; ambient vs
  temperature-controlled narrative decides. Matches the PRD cold-chain
  difficulty example adapted to the road family present in the library.
- MC-12/MC-14/MC-15/MC-16: rail-vs-road, domestic-vs-short-haul air, TEU size
  class, bulk-vs-container. Caveat recorded: C-33 pairs a 26,000 kg load with
  an 8000+ TEU ultra-large class purely to test size-class discrimination;
  real-world loads of that size would sail on smaller classes. Accepted for
  matching-logic testing; no change required.

## unit_conversion (MC-17..MC-24) — reviewed, one methodology note

- MC-17: 41 MMBtu → 12,013 kWh (1 BTU = 0.000293 kWh per PRD 4.4 table);
  factor is per kWh on a net-CV basis. Methodology note: the PRD conversion
  table does not distinguish net/gross CV; the net-CV factor is used and the
  approximation is intentional test scope, not an error.
- MC-18/22: GJ→kWh (277.78), MWh→kWh. MC-19/24: litres and US gallons →
  factor basis m3/L. MC-20/23: pounds→kilograms. MC-21: miles→kilometers.
  All conversion constants match the PRD 4.4 table exactly (0.4536, 1.609,
  3.785, 277.78, 0.000293).

## semantic_inference (MC-25..MC-32) — reviewed, no objections

- MC-25 (PRD's own example adapted): LCL consolidation wording + terminal
  handling fee + port pair must resolve to container sea, not air.
- MC-26: express courier implies the air network. MC-27/28: coils/copper map
  to the generic primary-metal factor rather than can-specific factors.
- MC-29: food purchase must not map to a waste-disposal factor.
- MC-30: steel drums (formed steel containers) closest to the steel-can
  factor which includes forming. MC-31: t-shirts→clothing. MC-32: groupage
  consolidation implies HGV average rigid rather than a van.

## boundary_caliber (MC-33..MC-40) — reviewed, no objections

Pairs test well-to-tank vs tank-to-wheel (diesel, petrol, sea, rail, HGV),
primary vs recycled material (aluminium closed-loop, PET), and waste-treatment
route (landfill vs anaerobic digestion). These consume the real DEFRA
Fuels/WTT-fuels and freight/WTT-freight pairs plus material variants; all ids
verified unique-resolvable in the 743-factor library.

## Conclusion

40/40 cases reviewed; 2 doubts raised and resolved during build (clothing
variant naming; propane kWh basis) plus 1 accepted realism caveat (C-33 vessel
class). No unresolved objections.
