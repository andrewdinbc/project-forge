'use client';

import { useState, useRef, useEffect } from 'react';
import { getCurrentUser } from '@/lib/auth';
import { errorMessageOr } from '@/lib/error-message';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  fileUrl?: string | null;
  generator?: string | null;
}

// "Build with Forge" -- per Aj: a chat box that actually runs the real
// generators behind the scenes, not just points you at the right tool
// (that's what the existing "Ask Forge" widget does -- this is
// deliberately a separate, differently-labeled widget so the two
// purposes -- "help me find the tool" vs "just build it" -- never get
// confused with each other). Calls the real Forge Orchestrator
// (/api/orchestrator), the same shared backend Hyperion's CEO uses.
export default function BuildAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setError(null);
    const nextMessages = [...messages, { role: 'user' as const, content: text }];
    setMessages(nextMessages);
    setSending(true);
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not signed in');

      const res = await fetch('/api/orchestrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, instruction: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not build that');

      const fileUrl = data.result?.pdfUrl || data.result?.url || data.result?.file_url || null;
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: fileUrl
            ? `Done -- built with ${data.generator}. Ready to review.`
            : `Ran ${data.generator}, but I don't see a direct file link in the result -- check Library Parts or Products for it.`,
          fileUrl,
          generator: data.generator,
        },
      ]);
    } catch (e) {
      setError(errorMessageOr(e, 'Something went wrong'));
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-full bg-emerald-600 text-white px-4 py-3 shadow-lg hover:bg-emerald-700 transition-colors"
      >
        <span className="text-lg">🛠️</span>
        <span className="text-sm font-semibold">Build with Forge</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 left-6 z-50 w-96 max-w-[calc(100vw-3rem)] bg-white border border-slate-200 rounded-xl shadow-2xl flex flex-col" style={{ height: 480 }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-emerald-600 rounded-t-xl">
        <div>
          <p className="text-sm font-semibold text-white">🛠️ Build with Forge</p>
          <p className="text-[11px] text-emerald-100">Tell me what to make -- I'll actually build it.</p>
        </div>
        <button onClick={() => setOpen(false)} className="text-white text-lg leading-none px-1">×</button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-slate-400 italic">
            e.g. "Make a word search with 10 solar system vocabulary words for grade 3"
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`text-sm ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
            <span
              className={`inline-block rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-wrap ${
                m.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-800'
              }`}
            >
              {m.content}
            </span>
            {m.fileUrl && (
              <div className="mt-1">
                <a
                  href={m.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-emerald-700 underline"
                >
                  Open the file →
                </a>
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="text-left">
            <span className="inline-block rounded-lg px-3 py-2 bg-slate-100 text-slate-400 text-sm">Building…</span>
          </div>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <div className="border-t border-slate-200 p-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="What should I build?"
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="bg-emerald-600 text-white rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
