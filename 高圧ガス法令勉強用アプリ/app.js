const $ = id => document.getElementById(id);
const KEY = "koatsu-quiz-v1";

// 成績は localStorage に保存(使えない環境でも動作する)
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
let record = load(); // { 問題index: {right, wrong, last} }

let list = [], pos = 0, correct = 0, answered = false;

const cats = ["すべて", ...new Set(QUESTIONS.map(q => q[0]))];
$("cat").innerHTML = cats.map(c => `<option>${c}</option>`).join("");

function show(id) { ["setup", "quiz", "summary"].forEach(s => $(s).classList.toggle("hidden", s !== id)); }

function renderStats() {
  const done = Object.values(record).reduce((n, r) => n + r.right + r.wrong, 0);
  const right = Object.values(record).reduce((n, r) => n + r.right, 0);
  const wrong = Object.values(record).filter(r => r.last === false).length;
  $("stats").textContent = `累計 ${done}問回答 / 正解 ${right}問 / 現在の苦手 ${wrong}問 (全${QUESTIONS.length}問)`;
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

$("start").onclick = () => {
  const cat = $("cat").value, mode = $("mode").value;
  list = QUESTIONS.map((q, i) => i).filter(i => cat === "すべて" || QUESTIONS[i][0] === cat);
  if (mode === "wrong") list = list.filter(i => record[i] && record[i].last === false);
  if (!list.length) { alert("該当する問題がありません。"); return; }
  if (mode !== "order") shuffle(list);
  pos = 0; correct = 0; show("quiz"); showQ();
};

function showQ() {
  const q = QUESTIONS[list[pos]];
  answered = false;
  $("cat-label").textContent = q[0];
  $("progress").textContent = `${pos + 1} / ${list.length}`;
  $("bar").style.width = `${(pos / list.length) * 100}%`;
  $("question").textContent = q[1];
  $("feedback").classList.add("hidden");
  document.querySelectorAll("#answer-btns button").forEach(b => b.disabled = false);
}

document.querySelectorAll("#answer-btns button").forEach(b => b.onclick = () => {
  if (answered) return;
  answered = true;
  const idx = list[pos], q = QUESTIONS[idx];
  const ok = (b.dataset.a === "1") === q[2];
  if (ok) correct++;
  const r = record[idx] || { right: 0, wrong: 0 };
  ok ? r.right++ : r.wrong++; r.last = ok; record[idx] = r; save(record);
  $("result").textContent = ok ? "⭕ 正解!" : `❌ 不正解(正解は ${q[2] ? "○" : "×"})`;
  $("result").className = "result " + (ok ? "ok" : "ng");
  $("exp").textContent = q[3];
  $("ref").textContent = "根拠: " + q[4];
  $("feedback").classList.remove("hidden");
  document.querySelectorAll("#answer-btns button").forEach(x => x.disabled = true);
  $("next").textContent = pos + 1 < list.length ? "次の問題へ" : "結果を見る";
});

$("next").onclick = () => {
  if (pos + 1 < list.length) { pos++; showQ(); return; }
  $("score").textContent = `${list.length}問中 ${correct}問正解(${Math.round(correct / list.length * 100)}%)`;
  show("summary");
};
$("quit").onclick = () => { renderStats(); show("setup"); };
$("again").onclick = () => { renderStats(); show("setup"); };
$("reset").onclick = () => { if (confirm("成績をリセットしますか?")) { record = {}; save(record); renderStats(); } };

renderStats();
