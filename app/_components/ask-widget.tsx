"use client";

import { useEffect, useRef, useState } from "react";
import { ASK_LIMITS, ASK_STARTERS } from "@/app/_lib/ask";
import { ArrowRightIcon, ChatIcon, CloseIcon } from "./icons";

// Ask Stow as a floating chat: a button at the bottom right opens a panel there
// on larger screens, and a full-screen sheet on phones. The conversation is kept
// in sessionStorage so it survives moving between pages (each page re-renders the shell).

type Message = {
  role: "user" | "assistant";
  content: string;
  failed?: boolean;
};
type Saved = { messages: Message[]; remaining: number | null };

const STORE_KEY = "stow-ask";
const PHONE = "(max-width: 639px)";

function load(): Saved {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Saved;
      if (Array.isArray(s.messages))
        return {
          messages: s.messages.filter((m) => m.content),
          remaining: s.remaining ?? null,
        };
    }
  } catch {}
  return { messages: [], remaining: null };
}

function save(s: Saved) {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {}
}

export function AskWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const loaded = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Restore the conversation once, after hydration.
  useEffect(() => {
    const s = load();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser-only storage after hydration
    setMessages(s.messages);
    setRemaining(s.remaining);
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (loaded.current && !busy)
      save({
        messages: messages.filter((m) => m.content && !m.failed),
        remaining,
      });
  }, [messages, remaining, busy]);

  useEffect(() => {
    // Scroll only the message list (scrollIntoView would also shift the panel itself).
    const list = listRef.current;
    if (open && list) list.scrollTop = list.scrollHeight;
  }, [open, messages, status]);

  // While open: Escape closes, focus goes to the box, and on phones the page behind doesn't scroll.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const phone = window.matchMedia(PHONE).matches;
    const prev = document.documentElement.style.overflow;
    if (phone) document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = prev;
    };
  }, [open]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => launcherRef.current?.focus());
  }

  async function ask(question: string) {
    const q = question.trim();
    if (busy) return;
    if (!q) return setInputError("Type a question first.");
    if (q.length > ASK_LIMITS.maxQuestionChars)
      return setInputError(
        `Keep questions under ${ASK_LIMITS.maxQuestionChars} characters.`,
      );
    setInputError(null);
    setDraft("");
    const sent: Message[] = [
      ...messages.filter((m) => !m.failed),
      { role: "user", content: q },
    ];
    setMessages([...sent, { role: "assistant", content: "" }]);
    setBusy(true);
    setStatus("Thinking…");

    const setAnswer = (update: (a: Message) => Message) =>
      setMessages((all) => [...all.slice(0, -1), update(all[all.length - 1])]);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: sent.map(({ role, content }) => ({ role, content })),
        }),
      });
      if (!res.ok || !res.body) {
        const { error } = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setAnswer(() => ({
          role: "assistant",
          content: error ?? "Ask Stow isn't available right now.",
          failed: true,
        }));
        return;
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line) as {
            type: string;
            text?: string;
            message?: string;
            remaining?: number;
          };
          if (e.type === "text" && e.text) {
            setStatus(null);
            setAnswer((a) => ({ ...a, content: a.content + e.text }));
          } else if (e.type === "status" && e.text) {
            setStatus(e.text);
          } else if (e.type === "done" && typeof e.remaining === "number") {
            setRemaining(e.remaining);
          } else if (e.type === "error") {
            setAnswer((a) => ({
              ...a,
              content: [a.content, e.message].filter(Boolean).join("\n\n"),
              failed: !a.content,
            }));
          }
        }
      }
    } catch {
      setAnswer((a) => ({
        ...a,
        content:
          a.content ||
          "Couldn't reach Ask Stow. Check your connection and try again.",
        failed: !a.content,
      }));
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <>
      {!open ? (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 inline-flex items-center gap-2 rounded-full bg-primary py-3 pr-5 pl-4 font-semibold text-white shadow-[0_12px_32px_-12px_rgba(6,15,33,0.6)] hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hero lg:right-6 lg:bottom-6"
        >
          <ChatIcon className="size-5" />
          Ask Stow
        </button>
      ) : null}

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ask-title"
          // Phones: the whole screen. Larger screens: a panel whose bottom-right corner is
          // exactly where the "Ask Stow" button sits, opening out of it. The panel is the
          // 400×640 design drawn at 80% (text included) via `zoom` on the inner wrapper.
          className="fixed inset-0 z-40 bg-surface text-text sm:inset-auto sm:right-4 sm:bottom-[calc(5.25rem+env(safe-area-inset-bottom))] sm:h-[min(512px,calc(100dvh-8rem))] sm:w-[320px] sm:origin-bottom-right sm:overflow-hidden sm:rounded-[20px] sm:border sm:border-border sm:shadow-[0_20px_48px_-16px_rgba(6,15,33,0.55)] sm:motion-safe:animate-[ask-open_180ms_ease-out] lg:right-6 lg:bottom-6 lg:h-[min(512px,calc(100dvh-3rem))]"
        >
          <div className="flex h-full w-full flex-col sm:[zoom:0.8]">
            <header className="flex items-center gap-3 bg-frame px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-frame-text sm:pt-3">
              <span
                className="grid size-9 shrink-0 place-items-center rounded-full bg-hero/20 text-hero"
                aria-hidden
              >
                <ChatIcon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="ask-title" className="font-bold leading-tight">
                  Ask Stow
                </h2>
                <p className="truncate text-xs text-frame-muted">
                  Your savings, budgets and the markets
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close Ask Stow"
                className="grid size-10 shrink-0 place-items-center rounded-xl hover:bg-frame-raised"
              >
                <CloseIcon className="size-5" />
              </button>
            </header>

            <div
              ref={listRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
            >
              {messages.length === 0 ? (
                <div>
                  <p className="text-sm text-text-muted">
                    Ask in plain words. Answers use your Stow balances, goals
                    and budgets, and live market data from True Markets.
                  </p>
                  <div className="mt-4 flex flex-col items-start gap-2">
                    {ASK_STARTERS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => ask(s)}
                        className="rounded-full border border-border bg-surface-raised px-3.5 py-2 text-left text-sm font-semibold hover:border-hero hover:text-hero"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <ol
                  aria-label="Conversation"
                  aria-live="polite"
                  className="flex flex-col gap-3"
                >
                  {messages.map((m, i) => (
                    <li
                      key={i}
                      className={
                        m.role === "user" ? "flex justify-end" : "flex"
                      }
                    >
                      <div
                        className={
                          m.role === "user"
                            ? "max-w-[85%] rounded-[20px] rounded-br-md bg-primary px-4 py-2.5 text-[15px] text-white"
                            : `max-w-[92%] rounded-[20px] rounded-bl-md border px-4 py-2.5 text-[15px] leading-relaxed ${
                                m.failed
                                  ? "border-critical/30 bg-critical-bg text-critical"
                                  : "border-border bg-surface-raised"
                              }`
                        }
                      >
                        {m.role === "assistant" &&
                        !m.content &&
                        i === messages.length - 1 &&
                        status ? (
                          <span className="text-sm text-text-muted">
                            {status}
                          </span>
                        ) : (
                          <p className="whitespace-pre-wrap break-words">
                            {m.content}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="border-t border-border bg-surface px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void ask(draft);
                }}
                className="flex items-end gap-2 rounded-[18px] border border-border bg-surface-raised p-1.5 focus-within:border-hero"
              >
                <label htmlFor="ask-input" className="sr-only">
                  Your question
                </label>
                <textarea
                  ref={inputRef}
                  id="ask-input"
                  rows={1}
                  value={draft}
                  maxLength={ASK_LIMITS.maxQuestionChars + 50}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (inputError) setInputError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void ask(draft);
                    }
                  }}
                  placeholder="Ask about your money…"
                  aria-invalid={inputError ? true : undefined}
                  aria-describedby={inputError ? "ask-error" : "ask-note"}
                  className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2.5 py-2 text-[16px] outline-none field-sizing-content"
                />
                <button
                  type="submit"
                  disabled={busy}
                  aria-label="Send question"
                  className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ArrowRightIcon className="size-5" />
                </button>
              </form>
              {inputError ? (
                <p
                  id="ask-error"
                  role="alert"
                  className="mt-1.5 px-1 text-sm text-critical"
                >
                  {inputError}
                </p>
              ) : null}
              <p
                id="ask-note"
                className="mt-2 px-1 text-[11px] leading-snug text-text-muted"
              >
                Explains only: it can&apos;t move money, and it isn&apos;t
                financial advice. AI answers (Claude) can be wrong.{" "}
                {remaining !== null
                  ? `${remaining} of ${ASK_LIMITS.perDay} questions left today.`
                  : `Up to ${ASK_LIMITS.perDay} a day.`}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
