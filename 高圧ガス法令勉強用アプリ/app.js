const $ = id => document.getElementById(id);
const KEY = "koatsu-quiz-v2";

// 成績は記述(statement)単位で localStorage に保存する(使えない環境でも動作する)
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
let record = load(); // { 記述id: {right, wrong, last} }

const STM = QUESTIONS.map((q, i) => ({ id: i, cat: q[0], text: q[1], ok: q[2], exp: q[3], ref: q[4] }));
const CATS = [...new Set(STM.map(s => s.cat))];
const KANA = ["イ", "ロ", "ハ"];
// 選択肢5つ。各行は イ・ロ・ハ が正しい(1)か誤り(0)かの組合せ
const PATTERNS = [[1, 0, 0], [0, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const CHOICES = ["イのみ", "ロのみ", "イ、ハのみ", "ロ、ハのみ", "イ、ロ、ハ"];

let selCat = "すべて", round = [], pos = 0, correct = 0, answered = false;

const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ico = c => c === "すべて" ? "全" : c[0];

// --- 分野ストーリー ---
function renderStories() {
  $("stories").innerHTML = ["すべて", ...CATS].map(c =>
    `<button class="story" data-c="${c}" aria-pressed="${c === selCat}"><span class="ring"><span>${ico(c)}</span></span><small>${c}</small></button>`).join("");
  $("stories").querySelectorAll(".story").forEach(b => b.onclick = () => { selCat = b.dataset.c; renderStories(); });
  $("set-avatar").textContent = ico(selCat);
  $("set-name").textContent = selCat;
}

function renderStats() {
  const v = Object.values(record);
  const done = v.reduce((n, r) => n + r.right + r.wrong, 0), right = v.reduce((n, r) => n + r.right, 0);
  const weak = v.filter(r => r.last === false).length;
  $("stats").textContent = `累計 ${done}回答 / 正解 ${right} / 苦手な記述 ${weak}件 (全${STM.length}記述)`;
}

// --- 問題生成: 同じ分野から3つの記述を選び、5つの選択肢のどれかが正解になるようにする ---
function build(cat, used, anchor) {
  const pool = STM.filter(s => s.cat === cat);
  for (let t = 0; t < 60; t++) {
    const pi = rnd(5), pat = PATTERNS[pi], chosen = [null, null, null], refs = new Set();
    if (anchor) {
      const slots = [0, 1, 2].filter(k => pat[k] === (anchor.ok ? 1 : 0));
      if (!slots.length) continue;
      const k = slots[rnd(slots.length)]; chosen[k] = anchor; refs.add(anchor.ref);
    }
    let fail = false;
    for (let k = 0; k < 3 && !fail; k++) {
      if (chosen[k]) continue;
      let c = pool.filter(s => s.ok === !!pat[k] && !chosen.includes(s) && (t >= 30 || !refs.has(s.ref)));
      const fresh = c.filter(s => !used.has(s.id));
      if (fresh.length) c = fresh;
      if (!c.length) { fail = true; break; }
      chosen[k] = c[rnd(c.length)]; refs.add(chosen[k].ref);
    }
    if (!fail) return { cat, stmts: chosen, answer: pi };
  }
  return null;
}

function makeRound(n, mode) {
  const used = new Set(), out = [];
  if (mode === "wrong") {
    let anchors = STM.filter(s => record[s.id] && record[s.id].last === false && (selCat === "すべて" || s.cat === selCat));
    shuffle(anchors);
    for (const a of anchors.slice(0, n)) { const q = build(a.cat, used, a); if (q) { out.push(q); q.stmts.forEach(s => used.add(s.id)); } }
    return out;
  }
  for (let guard = 0; out.length < n && guard < n * 10; guard++) {
    const cat = selCat === "すべて" ? CATS[rnd(CATS.length)] : selCat;
    const q = build(cat, used, null);
    if (q) { out.push(q); q.stmts.forEach(s => used.add(s.id)); }
  }
  return out;
}

function show(id) { ["setup", "quiz", "summary"].forEach(s => $(s).hidden = s !== id); window.scrollTo(0, 0); }

$("start").onclick = () => {
  round = makeRound(+$("num").value, $("mode").value);
  if (!round.length) { $("stats").textContent = "該当する問題がありません。先に通常モードで解いてみましょう。"; return; }
  pos = 0; correct = 0; show("quiz"); showQ();
};

function renderBars(state) {
  $("bars").innerHTML = round.map((_, i) => `<i class="${state[i] || (i === pos ? "now" : "")}"></i>`).join("");
}
let barState = [];

function showQ() {
  const q = round[pos]; answered = false;
  if (pos === 0) barState = [];
  renderBars(barState);
  $("q-avatar").textContent = ico(q.cat);
  $("q-cat").textContent = q.cat;
  $("q-no").textContent = `第${pos + 1}問 / ${round.length}問`;
  $("post").classList.remove("answered");
  $("stmts").innerHTML = q.stmts.map((s, k) =>
    `<li data-k="${k}"><span class="kana k${k}">${KANA[k]}</span><p>${s.text}<span class="verdict"></span><span class="expl"></span></p></li>`).join("");
  $("choices").innerHTML = CHOICES.map((c, i) => `<button class="choice" data-i="${i}"><b>${i + 1}</b>${c}</button>`).join("");
  $("choices").querySelectorAll(".choice").forEach(b => b.onclick = () => answer(+b.dataset.i));
  $("after").hidden = true; $("next").hidden = true;
}

const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="hg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fa7e1e"/><stop offset="1" stop-color="#d62976"/></linearGradient></defs><path fill="url(#hg)" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.6 2.6 5 6 5c2 0 3.4 1.1 4 2.2.6-1.1 2-2.2 4-2.2 3.4 0 5.1 3.6 3.6 6.8C19.5 16.4 12 21 12 21z"/></svg>';
const CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M8 8l8 8M16 8l-8 8" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>';

function answer(c) {
  if (answered) return; answered = true;
  const q = round[pos], ok = c === q.answer;
  if (ok) correct++;
  barState[pos] = ok ? "done" : "bad";
  // 選んだ選択肢が各記述をどう判断したことになるかで、記述ごとの成績を更新
  q.stmts.forEach((s, k) => {
    const hit = !!PATTERNS[c][k] === s.ok;
    const r = record[s.id] || { right: 0, wrong: 0 };
    hit ? r.right++ : r.wrong++; r.last = hit; record[s.id] = r;
  });
  save(record);
  $("post").classList.add("answered");
  $("stmts").querySelectorAll("li").forEach((li, k) => {
    const s = q.stmts[k];
    li.classList.add(s.ok ? "t" : "f");
    li.querySelector(".verdict").textContent = s.ok ? "○ 正しい記述" : "× 誤った記述";
    li.querySelector(".expl").textContent = `${s.exp}(${s.ref})`;
  });
  $("choices").querySelectorAll(".choice").forEach(b => {
    b.disabled = true;
    if (+b.dataset.i === q.answer) b.classList.add("right");
    else if (+b.dataset.i === c) b.classList.add("wrongpick");
  });
  $("fb").className = "feedback " + (ok ? "ok" : "ng");
  $("fb").innerHTML = ok ? `${HEART}<span>正解!</span>` : `${CROSS}<span>不正解(正解は ${q.answer + 1}. ${CHOICES[q.answer]})</span>`;
  $("after").hidden = false;
  $("next").hidden = false;
  $("next").textContent = pos + 1 < round.length ? "次の問題へ" : "結果を見る";
  renderBars(barState);
}

$("next").onclick = () => {
  if (pos + 1 < round.length) { pos++; showQ(); return; }
  const pct = Math.round(correct / round.length * 100);
  $("score").textContent = `${pct}%`;
  $("score-sub").textContent = `${round.length}問中 ${correct}問正解`;
  show("summary");
};
$("quit").onclick = () => { renderStats(); show("setup"); };
$("again").onclick = () => { renderStats(); show("setup"); };
$("reset").onclick = () => { record = {}; save(record); renderStats(); };

renderStories(); renderStats();
