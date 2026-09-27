import type { Metadata } from "next";
import Link from "next/link";
import { CheckIcon, RulerIcon, SparkIcon, WrenchIcon } from "@/components/ui/icons";
import { buttonClass, cardClass, eyebrowClass } from "@/components/ui/styles";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "You describe it, the AI designer proposes, a rules engine checks every real dimension, and we assemble, " +
    "regulate and test your watch by hand.",
};

const STEPS = [
  {
    icon: SparkIcon,
    title: "You describe it, the designer proposes",
    body:
      "Tell the AI designer what you have in mind: a style, a size, a colour, an occasion. It picks real parts " +
      "from our catalogue and explains its choices. Or skip the chat and choose every part yourself.",
  },
  {
    icon: RulerIcon,
    title: "The rules engine checks real dimensions",
    body:
      "Every design is checked against the measured sizes of each part, the way a watchmaker would at the " +
      "bench. When something doesn't fit, it tells you why and suggests parts that do.",
  },
  {
    icon: WrenchIcon,
    title: "We assemble it by hand, then test it",
    body:
      "We source the parts, fit the dial and hands, case the movement and regulate it on a timegrapher. " +
      "It ships only after a pressure test, a 24-hour run and a close look under the loupe.",
  },
];

const EXAMPLE_RULES = [
  "The dial must sit in the case's dial seat to within 0.2 mm. Too small and it rattles; too big and it won't go in.",
  "Hands press onto the movement's pinions, so their holes must match to within 0.02 mm.",
  "A dial's feet are placed for one crown position. A dial made for a crown at 3 won't line up in a case with its crown at 4.",
  "A date window needs a movement that can show a date there, or it would frame a blank disc.",
  "The strap must be exactly as wide as the space between the lugs.",
  "A GMT movement needs a fourth hand, and a scale to read it against.",
  "We never print another watch brand, or “Swiss”, on a dial: our movements aren't Swiss, and honesty matters.",
];

const ROADMAP = [
  {
    phase: "Phase 1",
    status: "Now",
    title: "Hand-built NH35 watches",
    body:
      "Modular automatic watches built around the NH3x family of movements: robust, serviceable and honest. " +
      "Each one assembled, regulated and tested by hand, one at a time.",
  },
  {
    phase: "Phase 2",
    status: "Next",
    title: "Open the atelier to other creators",
    body:
      "Designers and small brands publish their own designs and parts on the platform, with the same rules " +
      "engine checking every build.",
  },
  {
    phase: "Phase 3",
    status: "Later",
    title: "Our own brand and higher horology",
    body:
      "What we learn at the bench goes into a line of our own: finer finishing, better movements, and " +
      "eventually watches made with more of our own hands.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 pb-12 sm:px-6 lg:pt-14">
      <header className="max-w-3xl">
        <p className={eyebrowClass}>How it works</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink sm:text-6xl">
          Your idea, real parts, <em className="font-normal text-brass-ink">our hands</em>.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-ink-soft">
          Atelier is a small workshop that builds mechanical watches from modular parts. You design the watch; we
          make sure it can really be built, then build it.
        </p>
      </header>

      <ol className="mt-12 grid gap-5 md:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, body }, index) => (
          <li key={title} className={`${cardClass} p-6`}>
            <div className="flex items-center justify-between">
              <span className="flex size-11 items-center justify-center rounded-full bg-brass-soft text-brass-ink">
                <Icon className="size-5" />
              </span>
              <span aria-hidden="true" className="font-display text-4xl font-semibold text-line-strong">
                {index + 1}
              </span>
            </div>
            <h2 className="mt-5 font-display text-xl font-semibold text-ink">{title}</h2>
            <p className="mt-2 leading-relaxed text-ink-soft">{body}</p>
          </li>
        ))}
      </ol>

      <section aria-labelledby="rules-title" className="mt-16 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          <h2 id="rules-title" className="font-display text-3xl font-semibold tracking-tight text-ink">
            A few of the rules, in plain words
          </h2>
          <p className="mt-3 leading-relaxed text-ink-soft">
            Each rule comes from how the parts physically go together. Some only warn you about a trade-off, like a
            date the crown can set but the dial doesn&rsquo;t show. Others stop the build, because the watch
            couldn&rsquo;t be assembled or wouldn&rsquo;t work.
          </p>
          <div className="mt-6 rounded-xl border border-brass/40 bg-brass-soft p-5">
            <p className="font-display text-lg font-semibold text-ink">The AI never decides whether a watch can be built.</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              It suggests; the rules decide. The same design always gets the same answer, and every answer comes with
              its reason. If the AI proposes something that doesn&rsquo;t fit, you&rsquo;ll see exactly why.
            </p>
          </div>
        </div>
        <ul className={`${cardClass} divide-y divide-line`}>
          {EXAMPLE_RULES.map((rule) => (
            <li key={rule} className="flex gap-3 p-4">
              <CheckIcon className="mt-0.5 size-4 shrink-0 text-ok" />
              <span className="leading-relaxed text-ink">{rule}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="roadmap-title" className="mt-16">
        <h2 id="roadmap-title" className="font-display text-3xl font-semibold tracking-tight text-ink">
          Starting small, with the big picture in mind
        </h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-ink-soft">
          We&rsquo;re learning the craft one watch at a time. Here&rsquo;s where that leads.
        </p>
        <ol className="mt-8 grid gap-5 md:grid-cols-3">
          {ROADMAP.map(({ phase, status, title, body }, index) => (
            <li
              key={phase}
              className={`rounded-xl border p-6 ${
                index === 0 ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink"
              }`}
            >
              <p className="flex items-center justify-between text-xs font-medium tracking-[0.14em] uppercase">
                <span className={index === 0 ? "text-paper/70" : "text-brass-ink"}>{phase}</span>
                <span
                  className={`rounded-full px-2 py-0.5 tracking-normal normal-case ${
                    index === 0 ? "bg-paper/15 text-paper" : "bg-surface-muted text-ink-soft"
                  }`}
                >
                  {status}
                </span>
              </p>
              <h3 className="mt-4 font-display text-xl font-semibold">{title}</h3>
              <p className={`mt-2 leading-relaxed ${index === 0 ? "text-paper/80" : "text-ink-soft"}`}>{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className={`${cardClass} mt-16 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8`}>
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">Ready to design yours?</h2>
          <p className="mt-1 text-ink-soft">Start from one of our designs, or from a single sentence.</p>
        </div>
        <Link href="/" className={buttonClass("primary", "lg")}>
          Design your watch
        </Link>
      </div>
    </div>
  );
}
