import { useEffect, useRef, useState } from 'react';
import { ask, SUGGESTIONS } from '../sim/assistant.js';
import { STATUS_COLOR } from './ui.jsx';

/**
 * Chat panel over the rule-based assistant.
 *
 * The short delay before each reply is deliberate: answers are computed
 * synchronously, and having them appear instantly reads as a lookup table
 * rather than something considering the question.
 */

const THINK_MS = 420;

function AnswerBlock({ answer }) {
  return (
    <div className="msg__answer">
      <p className="msg__lead">{answer.lead}</p>

      {answer.facts?.length > 0 && (
        <dl className="factlist">
          {answer.facts.map((f, i) => (
            <div className="factlist__row" key={i}>
              <dt>
                {f.tone && f.tone !== 'neutral' && (
                  <i className="factlist__dot" style={{ background: STATUS_COLOR[f.tone] }} />
                )}
                {f.label}
              </dt>
              <dd style={f.tone && f.tone !== 'neutral' ? { color: STATUS_COLOR[f.tone] } : undefined}>
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {answer.note && <p className="msg__note">{answer.note}</p>}
    </div>
  );
}

export default function Assistant({ context, onSelectVehicle }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      answer: {
        lead: "Ask me anything about the fleet. I read the live feed and the fuel, service and cost records, so the answers move as the data does.",
        facts: [],
        followUps: [],
      },
    },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);

  const scrollRef = useRef(null);
  const ctxRef = useRef(context);
  ctxRef.current = context;
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinking]);

  function send(text) {
    const question = text.trim();
    if (!question || thinking) return;

    setMessages((m) => [...m, { role: 'user', text: question }]);
    setInput('');
    setThinking(true);

    timerRef.current = setTimeout(() => {
      // Read context at answer time, not send time, so a slow question still
      // gets the freshest telemetry.
      const answer = ask(question, ctxRef.current);
      setMessages((m) => [...m, { role: 'assistant', answer }]);
      setThinking(false);
      if (answer.focus) onSelectVehicle(answer.focus);
    }, THINK_MS);
  }

  const lastAnswer = [...messages].reverse().find((m) => m.role === 'assistant')?.answer;
  const chips = (lastAnswer?.followUps?.length ? lastAnswer.followUps : SUGGESTIONS).slice(0, 4);

  return (
    <div className="chat">
      <div className="chat__log" ref={scrollRef}>
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div className="msg msg--user" key={i}>{m.text}</div>
          ) : (
            <div className="msg msg--bot" key={i}>
              <AnswerBlock answer={m.answer} />
            </div>
          )
        )}

        {thinking && (
          <div className="msg msg--bot">
            <span className="typing" aria-label="Thinking">
              <i /><i /><i />
            </span>
          </div>
        )}
      </div>

      <div className="chat__chips">
        {chips.map((s) => (
          <button key={s} className="chip" onClick={() => send(s)} disabled={thinking}>
            {s}
          </button>
        ))}
      </div>

      <form
        className="chat__input"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a vehicle, driver, fuel or cost…"
          aria-label="Ask the fleet assistant"
        />
        <button className="btn btn--primary" type="submit" disabled={thinking || !input.trim()}>
          Ask
        </button>
      </form>
    </div>
  );
}
