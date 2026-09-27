import { useId } from "react";
import { PERSONALIZATION_LIMITS } from "@/domain/catalog";
import { normalizePersonalizationText } from "@/domain/rules";
import type { Issue, Personalization, ResolvedSpec, ValidationReport } from "@/domain/types";
import { cardClass, inputClass } from "../ui/styles";

const ALLOWED_CHARACTERS = "Letters, numbers, spaces and . , ' & -";

interface PersonalizationPanelProps {
  personalization: Personalization;
  parts: ResolvedSpec;
  report: ValidationReport;
  onChange: (personalization: Personalization) => void;
}

export function PersonalizationPanel({ personalization, parts, report, onChange }: PersonalizationPanelProps) {
  const issuesFor = (ruleId: string) =>
    report.issues.filter((issue) => issue.ruleId === ruleId && issue.severity !== "info");

  const dialHint = parts.dial?.printable === false
    ? `The ${parts.dial.name} dial can't be printed on. Choose a printable dial to add text.`
    : `UV-printed in small capitals above 6 o'clock. ${ALLOWED_CHARACTERS}.`;
  const casebackHint =
    parts.case?.caseback === "display"
      ? `The ${parts.case.name} has a glass display caseback, which can't be engraved.`
      : `Laser-engraved on the solid caseback: a name, a date, a line that matters. ${ALLOWED_CHARACTERS}.`;

  return (
    <section aria-labelledby="personalization-title" className={`${cardClass} p-4`}>
      <h3 id="personalization-title" className="text-xs font-medium tracking-[0.12em] text-ink-faint uppercase">
        Personal touches
      </h3>
      <p className="mt-1 text-sm text-ink-soft">
        Every watch is made one at a time, so it can carry a line of your own; the price panel shows what it
        adds. Other watch brands and &ldquo;Swiss&rdquo; are never printed.
      </p>
      <div className="mt-4 flex flex-col gap-4">
        <TextField
          label="Dial text"
          value={personalization.dialText}
          maxLength={PERSONALIZATION_LIMITS.dialTextMaxLength}
          placeholder="e.g. Est. 2026"
          hint={dialHint}
          issues={issuesFor("dial-text")}
          onChange={(dialText) => onChange({ ...personalization, dialText: normalizePersonalizationText(dialText) })}
        />
        <TextField
          label="Caseback engraving"
          value={personalization.casebackEngraving}
          maxLength={PERSONALIZATION_LIMITS.casebackEngravingMaxLength}
          placeholder="e.g. For Sam, 12 June 2026"
          hint={casebackHint}
          issues={issuesFor("caseback-engraving")}
          onChange={(casebackEngraving) =>
            onChange({ ...personalization, casebackEngraving: normalizePersonalizationText(casebackEngraving) })
          }
        />
      </div>
    </section>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  maxLength: number;
  placeholder: string;
  hint: string;
  issues: Issue[];
  onChange: (value: string) => void;
}

function TextField({ label, value, maxLength, placeholder, hint, issues, onChange }: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const counterId = `${id}-counter`;
  const issuesId = `${id}-issues`;
  const hasErrors = issues.some((issue) => issue.severity === "error");
  const nearLimit = value.length >= maxLength - 3;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label} <span className="font-normal text-ink-faint">(optional)</span>
        </label>
        <span
          id={counterId}
          className={`text-xs tabular-nums ${nearLimit ? "text-warn" : "text-ink-faint"}`}
        >
          {value.length}/{maxLength}
          <span className="sr-only"> characters</span>
        </span>
      </div>
      <input
        id={id}
        type="text"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={hasErrors}
        aria-describedby={`${hintId} ${counterId}${issues.length > 0 ? ` ${issuesId}` : ""}`}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass(hasErrors)} mt-1.5`}
      />
      <p id={hintId} className="mt-1.5 text-xs leading-relaxed text-ink-faint">
        {hint}
      </p>
      {issues.length > 0 && (
        <ul id={issuesId} className="mt-1.5 flex flex-col gap-1">
          {issues.map((issue, index) => (
            <li
              key={`${issue.ruleId}-${index}`}
              className={`text-xs leading-relaxed ${issue.severity === "error" ? "text-danger" : "text-warn"}`}
            >
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
