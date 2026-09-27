import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { DESIGN_MESSAGE_MAX_LENGTH } from "@/domain/schemas";
import type { WatchSpec } from "@/domain/types";
import { ApiError, type DesignerInfo, fetchDesignerInfo, requestDesign } from "../apiClient";
import { CheckIcon, CrossIcon, SendIcon, SparkIcon, UndoIcon } from "../ui/icons";
import { buttonClass, cardClass, chipClass } from "../ui/styles";
import { PREVIEW_ID } from "./PreviewStage";
import { toHistory } from "./chatHistory";

const EXAMPLE_PROMPTS = [
  "A 38mm green field watch on leather",
  "An elegant dress watch for my wedding",
  "A travel GMT with a blue and red bezel",
  "A black titanium sport watch",
  "A vintage diver with gilt details",
];

interface ChatEntry {
  role: "user" | "assistant";
  content: string;
  /** Assistant turns only: what the proposal changed, and the rules engine's verdict on it. */
  changes?: string[];
  buildable?: boolean;
  proposal?: WatchSpec;
  /** The customer edited the design while the designer was answering, so the proposal waits for their go-ahead. */
  held?: boolean;
}

interface DesignerChatProps {
  spec: WatchSpec;
  /** Makes a proposal the design; the customer can undo it. */
  onApply: (proposal: WatchSpec) => void;
  /** The design an Undo would take back, if any. */
  undoableSpec: WatchSpec | null;
  onUndo: () => void;
  className?: string;
}

const sameDesign = (a: WatchSpec, b: WatchSpec) => JSON.stringify(a) === JSON.stringify(b);

export function DesignerChat({ spec, onApply, undoableSpec, onUndo, className = "" }: DesignerChatProps) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [designer, setDesigner] = useState<DesignerInfo | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  // The design as it is now, for comparing once a (possibly slow) answer arrives.
  const latestSpec = useRef(spec);
  useEffect(() => {
    latestSpec.current = spec;
  }, [spec]);

  useEffect(() => {
    const controller = new AbortController();
    fetchDesignerInfo(controller.signal)
      .then(setDesigner)
      .catch(() => {
        // The badge is informative only; the chat works without it.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [entries, pending]);

  async function send(message: string) {
    const text = message.trim();
    if (!text || pending) return;
    const history = toHistory(entries);
    const sentSpec = spec;
    setEntries((current) => [...current, { role: "user", content: text }]);
    setDraft("");
    setError(null);
    setPending(true);
    try {
      const response = await requestDesign({ message: text, currentSpec: sentSpec, history });
      const editedMeanwhile = !sameDesign(latestSpec.current, sentSpec);
      setEntries((current) => [
        ...current,
        {
          role: "assistant",
          content: response.reply,
          changes: response.changes,
          buildable: response.report.buildable,
          proposal: response.spec,
          held: editedMeanwhile,
        },
      ]);
      setDesigner((current) => ({ mode: response.mode, model: current?.model ?? null }));
      if (!editedMeanwhile) onApply(response.spec);
    } catch (caught) {
      // Put the message back so nothing typed is lost.
      setEntries((current) => current.slice(0, -1));
      setDraft(text);
      setError(
        caught instanceof ApiError
          ? (caught.fields.message ?? caught.message)
          : "The designer couldn't answer just now. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  function applyHeld(index: number) {
    const proposal = entries[index]?.proposal;
    if (!proposal) return;
    setEntries((current) => current.map((entry, at) => (at === index ? { ...entry, held: false } : entry)));
    onApply(proposal);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(draft);
  }

  function sendOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(draft);
    }
  }

  return (
    <section aria-labelledby="chat-title" className={`${cardClass} flex flex-col ${className}`}>
      <header className="border-b border-line p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 id="chat-title" className="font-display text-xl leading-tight font-semibold text-ink">
            Describe your dream watch
          </h2>
          <ModeBadge designer={designer} />
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
          A style, a size, colours, an occasion. The designer proposes real parts; the rules engine checks they fit.
        </p>
      </header>

      <div
        ref={logRef}
        role="log"
        aria-label="Conversation with the designer"
        aria-busy={pending}
        className="flex max-h-[26rem] min-h-40 flex-1 flex-col gap-3 overflow-y-auto p-4 xl:max-h-none"
      >
        {entries.length === 0 && (
          <div>
            <p className="text-xs font-medium tracking-[0.12em] text-ink-faint uppercase">Try one of these</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <li key={prompt}>
                  <button type="button" onClick={() => void send(prompt)} disabled={pending} className={`${chipClass()} text-left`}>
                    <SparkIcon className="size-3.5 shrink-0 text-brass-ink" />
                    {prompt}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {entries.map((entry, index) =>
          entry.role === "user" ? (
            <p
              key={index}
              className="max-w-[85%] self-end rounded-2xl rounded-br-sm bg-ink px-4 py-2.5 text-sm whitespace-pre-line text-paper"
            >
              <span className="sr-only">You: </span>
              {entry.content}
            </p>
          ) : (
            <AssistantMessage
              key={index}
              entry={entry}
              undoable={entry.proposal !== undefined && entry.proposal === undoableSpec}
              onApply={() => applyHeld(index)}
              onUndo={onUndo}
            />
          ),
        )}
        {pending && (
          <p className="flex items-center gap-2 self-start rounded-2xl rounded-bl-sm bg-surface-muted px-4 py-2.5 text-sm text-ink-soft">
            <SparkIcon className="size-4 text-brass-ink motion-safe:animate-pulse" />
            Sketching your watch&hellip;
          </p>
        )}
      </div>

      <form onSubmit={submit} className="border-t border-line p-3">
        {error && (
          <p role="alert" className="mb-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <label htmlFor={inputId} className="sr-only">
          Message the designer
        </label>
        <div className="flex items-end gap-2 rounded-xl border border-control-border bg-surface p-1.5 pl-3 has-focus-visible:border-brass-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brass-ink">
          <textarea
            id={inputId}
            rows={2}
            value={draft}
            maxLength={DESIGN_MESSAGE_MAX_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={sendOnEnter}
            placeholder="e.g. A 39mm diver with a burgundy bezel"
            className="min-w-0 flex-1 resize-none bg-transparent py-1.5 text-sm text-ink placeholder:text-ink-faint focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={pending || draft.trim().length === 0}
            aria-label="Send to the designer"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink text-paper transition-colors hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <SendIcon />
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-ink-faint">Enter to send, Shift+Enter for a new line</p>
      </form>
    </section>
  );
}

interface AssistantMessageProps {
  entry: ChatEntry;
  /** The proposal is the design now, and Undo would take it back. */
  undoable: boolean;
  onApply: () => void;
  onUndo: () => void;
}

function AssistantMessage({ entry, undoable, onApply, onUndo }: AssistantMessageProps) {
  const changes = entry.changes ?? [];
  return (
    <div className="max-w-[92%] self-start rounded-2xl rounded-bl-sm bg-surface-muted px-4 py-3 text-sm text-ink">
      <p className="whitespace-pre-line">
        <span className="sr-only">Designer: </span>
        {entry.content}
      </p>
      {changes.length > 0 && (
        <div className="mt-3 border-t border-line pt-2">
          <p className="text-xs font-medium text-ink-faint">What changed</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-xs text-ink-soft">
            {changes.map((change, index) => (
              <li key={index} className="flex gap-1.5">
                <span aria-hidden="true" className="text-brass-ink">
                  &bull;
                </span>
                {change}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${entry.buildable ? "text-ok" : "text-danger"}`}>
        {entry.buildable ? <CheckIcon className="size-3.5" /> : <CrossIcon className="size-3.5" />}
        {entry.buildable ? "Rules engine: buildable" : "Rules engine: needs changes, see “Can we build it?”"}
      </p>
      {entry.held ? (
        <div className="mt-3 border-t border-line pt-2">
          <p className="text-xs text-ink-soft">
            You changed the design while I was thinking, so I haven&rsquo;t applied this. Apply it anyway?
          </p>
          <button type="button" onClick={onApply} className={`${buttonClass("secondary", "sm")} mt-2`}>
            Apply this proposal
          </button>
        </div>
      ) : (
        undoable && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <button type="button" onClick={onUndo} className={buttonClass("ghost", "sm")}>
              <UndoIcon />
              Undo this proposal
            </button>
            {/* Below xl the watch is further up the page, out of sight. */}
            <a
              href={`#${PREVIEW_ID}`}
              className="text-xs text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-ink xl:hidden"
            >
              See your watch
            </a>
          </div>
        )
      )}
    </div>
  );
}

function ModeBadge({ designer }: { designer: DesignerInfo | null }) {
  const detailsId = useId();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  if (!designer) {
    return <span aria-hidden="true" className="h-6 w-28 shrink-0 rounded-full bg-surface-muted" />;
  }
  const claude = designer.mode === "claude";
  return (
    <span
      ref={wrapperRef}
      className="relative shrink-0"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
          claude ? "border-brass/50 bg-brass-soft text-brass-ink" : "border-line-strong bg-surface-muted text-ink-soft"
        }`}
      >
        <span aria-hidden="true" className={`size-1.5 rounded-full ${claude ? "bg-brass" : "bg-ink-faint"}`} />
        {claude ? "AI designer · Claude" : "Quick designer"}
      </button>
      <span
        id={detailsId}
        className={`absolute top-full right-0 z-20 mt-2 w-64 max-w-[calc(100vw-3rem)] rounded-lg bg-ink p-3 text-xs leading-relaxed font-normal text-paper shadow-lg ${
          open ? "block" : "hidden"
        }`}
      >
        {claude
          ? `Replies come from Claude${designer.model ? ` (${designer.model})` : ""}. It proposes parts; the rules engine alone decides what can be built.`
          : "Quick designer: it matches your words to parts in our catalogue; the rules engine alone decides what can be built."}
      </span>
    </span>
  );
}
