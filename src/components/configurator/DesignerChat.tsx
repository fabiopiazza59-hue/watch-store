import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { DESIGN_MESSAGE_MAX_LENGTH } from "@/domain/schemas";
import type { DesignResponse, WatchSpec } from "@/domain/types";
import { ApiError, type DesignerInfo, fetchDesignerInfo, requestDesign } from "../apiClient";
import { CheckIcon, CrossIcon, SendIcon, SparkIcon } from "../ui/icons";
import { cardClass, chipClass } from "../ui/styles";
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
}

interface DesignerChatProps {
  spec: WatchSpec;
  onDesign: (response: DesignResponse) => void;
  className?: string;
}

export function DesignerChat({ spec, onDesign, className = "" }: DesignerChatProps) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [designer, setDesigner] = useState<DesignerInfo | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputId = useId();

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
    setEntries((current) => [...current, { role: "user", content: text }]);
    setDraft("");
    setError(null);
    setPending(true);
    try {
      const response = await requestDesign({ message: text, currentSpec: spec, history });
      setEntries((current) => [
        ...current,
        {
          role: "assistant",
          content: response.reply,
          changes: response.changes,
          buildable: response.report.buildable,
        },
      ]);
      setDesigner((current) => ({ mode: response.mode, model: current?.model ?? null }));
      onDesign(response);
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
            <AssistantMessage key={index} entry={entry} />
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
        <div className="flex items-end gap-2 rounded-xl border border-line-strong bg-surface p-1.5 pl-3 has-focus-visible:border-brass-ink">
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

function AssistantMessage({ entry }: { entry: ChatEntry }) {
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
    </div>
  );
}

function ModeBadge({ designer }: { designer: DesignerInfo | null }) {
  const tooltipId = useId();
  if (!designer) {
    return <span aria-hidden="true" className="h-6 w-28 shrink-0 rounded-full bg-surface-muted" />;
  }
  const claude = designer.mode === "claude";
  return (
    <span className="group relative shrink-0">
      <button
        type="button"
        aria-describedby={tooltipId}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
          claude ? "border-brass/50 bg-brass-soft text-brass-ink" : "border-line-strong bg-surface-muted text-ink-soft"
        }`}
      >
        <span aria-hidden="true" className={`size-1.5 rounded-full ${claude ? "bg-brass" : "bg-ink-faint"}`} />
        {claude ? "AI designer · Claude" : "Offline designer"}
      </button>
      <span
        role="tooltip"
        id={tooltipId}
        className="absolute top-full right-0 z-20 mt-2 hidden w-64 max-w-[calc(100vw-3rem)] rounded-lg bg-ink p-3 text-xs leading-relaxed font-normal text-paper shadow-lg group-focus-within:block group-hover:block"
      >
        {claude
          ? `Replies come from Claude${designer.model ? ` (${designer.model})` : ""}. It proposes parts; the rules engine alone decides what can be built.`
          : "Running without an API key: a simpler keyword designer picks parts from your words. Setting ANTHROPIC_API_KEY on the server enables the full Claude designer."}
      </span>
    </span>
  );
}
