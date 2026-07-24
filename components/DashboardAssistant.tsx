'use client';

import { useState, useRef, useEffect } from 'react';
import { errorMessageOr } from '../lib/error-message';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Floating "ask a question" box for the Dashboard -- lets Aj ask things
// like "I like the color-by-number system, how do I apply it to a new
// product?" and get routed to the right tool (Composer vs Style Lab vs
// Bundles) without having to remember what each one does. Grounded in a
// description of the app's own features server-side; doesn't touch real
// product data.
export default function DashboardAssistant() {
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
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: messages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get a response');
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
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
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-blue-600 text-white px-4 py-3 shadow-lg hover:bg-blue-700 transition-colors"
      >
        <span className="text-lg">💬</span>
        <span className="text-sm font-semibold">Ask Forge</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] bg-white border border-slate-200 rounded-xl shadow-2xl flex flex-col" style={{ height: 480 }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-blue-600 rounded-t-xl">
        <div>
          <p className="text-sm font-semibold text-white">💬 Ask Forge</p>
          <p className="text-[11px] text-blue-100">Which tool should I use? How does X work?</p>
        </div>
        <button onClick={() => setOpen(false)} className="text-white text-lg leading-none px-1">×</button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-slate-400 italic">
            e.g. "I like the color-by-number system in one product, how do I apply it to a new one?"
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`text-sm ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
            <span
              className={`inline-block rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-wrap ${
                m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'
              }`}
            >
              {m.content}
            </span>
          </div>
        ))}
        {sending && (
          <div className="text-left">
            <span className="inline-block rounded-lg px-3 py-2 bg-slate-100 text-slate-400 text-sm">Thinking…</span>
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
          placeholder="Ask a question…"
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="btn-primary px-3 py-2 text-sm disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
