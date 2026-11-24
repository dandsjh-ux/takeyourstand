// Question CSV parsing (shared by server + browser).
// Supported layouts (header row is auto-detected):
//  1. Take Your Stand template: question, option_a, option_b, option_c, option_d, answer, coins, reference
//     answer may be a letter (A-D), a number (1-4) or the exact option text.
//  2. Blooket export: Question #, Question Text, Answer 1..4, Time Limit, Correct Answer(s)
//  3. "Correct / Incorrect" layout: Question, Correct Answer, Incorrect Answer 1..3

export function parseCSVRows(text) {
  const rows = [];
  let row = [], field = '', i = 0, q = false;
  text = String(text || '').replace(/^﻿/, '');
  while (i < text.length) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        q = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { q = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.map((r) => r.map((f) => f.trim()));
}

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

export function parseQuestionsCSV(text) {
  const rows = parseCSVRows(text).filter((r) => r.some((c) => c !== ''));
  const errors = [];
  let h = rows.findIndex((r) => r.some((c) => /question/i.test(c) && !/^question\s*#$/i.test(c.trim())));
  if (h < 0) return { questions: [], errors: ['Could not find a header row containing "question".'] };
  const header = rows[h].map(norm);
  const find = (re, not) => header.findIndex((c) => re.test(c) && !(not && not.test(c)));
  const qCol = (() => {
    let k = header.findIndex((c) => /question text/.test(c));
    if (k < 0) k = header.findIndex((c) => /question/.test(c) && !/#|number|no\./.test(c));
    return k;
  })();
  const incorrectCols = header.map((c, k) => (/incorrect|wrong/.test(c) ? k : -1)).filter((k) => k >= 0);
  const correctCol = find(/correct|^answer$|^answer \(|^correct/, /incorrect/);
  const optionCols = header.map((c, k) => (/^(option|choice)|^answer \d|^answer[ _]?[a-f]\b|^option_[a-f]/.test(c) ? k : -1)).filter((k) => k >= 0);
  const coinsCol = find(/coin|point/);
  const refCol = find(/ref|verse|scripture|explanation/);

  const out = [];
  for (let r = h + 1; r < rows.length; r++) {
    const row = rows[r];
    const question = (row[qCol] || '').trim();
    if (!question) continue;
    let choices = [], answer = -1;
    if (incorrectCols.length && correctCol >= 0) {
      const correct = (row[correctCol] || '').trim();
      const wrong = incorrectCols.map((k) => (row[k] || '').trim()).filter(Boolean);
      if (!correct || !wrong.length) { errors.push(`Row ${r + 1}: needs a correct and at least one incorrect answer.`); continue; }
      choices = shuffle([correct, ...wrong]);
      answer = choices.indexOf(correct);
    } else {
      const cols = optionCols.length ? optionCols : [];
      const raw = cols.map((k) => (row[k] || '').trim());
      // keep position info so numeric answers map correctly even if some are blank
      const ans = (row[correctCol] || '').trim();
      let idx = -1;
      if (/^[1-6]$/.test(ans.split(/[,;]/)[0])) idx = Number(ans.split(/[,;]/)[0]) - 1;
      else if (/^[a-fA-F]$/.test(ans)) idx = ans.toUpperCase().charCodeAt(0) - 65;
      else idx = raw.findIndex((c) => norm(c) === norm(ans));
      if (idx < 0 || !raw[idx]) { errors.push(`Row ${r + 1}: could not match the correct answer "${ans}".`); continue; }
      const correctText = raw[idx];
      choices = raw.filter(Boolean);
      answer = choices.indexOf(correctText);
      if (choices.length < 2) { errors.push(`Row ${r + 1}: needs at least two options.`); continue; }
    }
    const coins = coinsCol >= 0 && /^\d+$/.test(row[coinsCol] || '') ? Number(row[coinsCol]) : null;
    out.push({
      q: question.slice(0, 300),
      choices: choices.slice(0, 6).map((c) => c.slice(0, 160)),
      answer,
      coins,
      ref: refCol >= 0 ? (row[refCol] || '').slice(0, 200) : '',
    });
  }
  return { questions: out, errors };
}

export function questionsToCSV(questions) {
  const esc = (s) => {
    s = String(s ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = ['question,option_a,option_b,option_c,option_d,answer,coins,reference'];
  for (const q of questions) {
    const opts = [0, 1, 2, 3].map((k) => q.choices[k] || '');
    lines.push([q.q, ...opts, 'ABCDEF'[q.answer], q.coins ?? '', q.ref || ''].map(esc).join(','));
  }
  return lines.join('\n');
}

function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
