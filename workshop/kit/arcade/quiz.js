// kit/arcade/quiz.js — quiz engine with scoring, result tiers and keyboard support.
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createQuiz, attachKeyboard } from './quiz.js';
//   const quiz = createQuiz([
//     { q: 'What falls on door 1?', choices: ['Snow', 'Toast', 'A piano'], answer: 0, explain: 'Softly.' },
//     { q: 'Best cocoa topping?', choices: ['Marshmallow', 'Gravel'], answer: 0, points: 2 },
//   ], { tiers: [{ min: 0, text: 'Warm-up' }, { min: 2, text: 'Seasoned' }, { min: 3, text: 'Elf grade' }] });
//   render(quiz.current());                     // { index, total, q, choices }
//   const r = quiz.answer(0);                   // { correct, points, explain, done }
//   if (r.done) show(quiz.summary());           // { score, max, correct, total, tier, answers }
//   attachKeyboard(window, quiz, render);       // keys 1–9 answer, arrows move focus, Enter confirms
//   quiz.reset();

export function createQuiz(questions, { tiers = [], shuffle = null } = {}) {
  const qs = questions.map((q, i) => ({ ...q, points: q.points ?? 1, _i: i }));
  if (shuffle) for (let i = qs.length - 1; i > 0; i--) { const j = Math.floor(shuffle() * (i + 1)); [qs[i], qs[j]] = [qs[j], qs[i]]; }
  let index = 0, score = 0, correct = 0; const answers = []; let focus = 0;
  const api = {
    get length() { return qs.length; }, get score() { return score; }, get index() { return index; }, get focus() { return focus; },
    get done() { return index >= qs.length; },
    get max() { return qs.reduce((s, q) => s + q.points, 0); },
    current() { const q = qs[index]; return q ? { index, total: qs.length, q: q.q, choices: q.choices, focus } : null; },
    moveFocus(d) { const q = qs[index]; if (!q) return focus; focus = (focus + d + q.choices.length) % q.choices.length; return focus; },
    setFocus(i) { focus = i; },
    answer(choice = focus) {
      const q = qs[index]; if (!q) return { done: true };
      const ok = Array.isArray(q.answer) ? q.answer.includes(choice) : choice === q.answer;
      const pts = ok ? q.points : 0; score += pts; if (ok) correct++;
      answers.push({ question: q.q, choice, correct: ok, answer: q.answer, points: pts });
      index++; focus = 0;
      return { correct: ok, points: pts, explain: q.explain || '', answer: q.answer, done: index >= qs.length };
    },
    skip() { return api.answer(-1); },
    tier(s = score) { let t = null; for (const x of [...tiers].sort((a, b) => a.min - b.min)) if (s >= x.min) t = x; return t; },
    summary() { return { score, max: api.max, correct, total: qs.length, tier: api.tier(), answers: answers.map((a) => ({ ...a })) }; },
    reset() { index = 0; score = 0; correct = 0; answers.length = 0; focus = 0; },
  };
  return api;
}

/** Keyboard: digits pick a choice, arrows/Tab-free focus movement, Enter/Space confirm. Returns a disposer. */
export function attachKeyboard(target, quiz, render) {
  const h = (e) => {
    if (quiz.done) return;
    if (/^[1-9]$/.test(e.key)) { const i = Number(e.key) - 1; if (i < quiz.current().choices.length) { quiz.answer(i); render && render(quiz.current(), quiz); e.preventDefault(); } return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { quiz.moveFocus(1); render && render(quiz.current(), quiz); e.preventDefault(); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { quiz.moveFocus(-1); render && render(quiz.current(), quiz); e.preventDefault(); }
    else if (e.key === 'Enter' || e.key === ' ') { quiz.answer(); render && render(quiz.current(), quiz); e.preventDefault(); }
  };
  target.addEventListener('keydown', h); return () => target.removeEventListener('keydown', h);
}

/** Render one question as accessible HTML (radio-like buttons). Wire clicks: data-choice attribute. */
export function renderQuestionHTML(cur) {
  if (!cur) return '';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<div class="quiz-q" role="group" aria-labelledby="quiz-q-${cur.index}"><p class="quiz-progress">${cur.index + 1} / ${cur.total}</p><h2 id="quiz-q-${cur.index}">${esc(cur.q)}</h2><ol class="quiz-choices">${cur.choices.map((c, i) => `<li><button type="button" class="quiz-choice${i === cur.focus ? ' is-focus' : ''}" data-choice="${i}" aria-keyshortcuts="${i + 1}"><kbd>${i + 1}</kbd> ${esc(c)}</button></li>`).join('')}</ol></div>`;
}
