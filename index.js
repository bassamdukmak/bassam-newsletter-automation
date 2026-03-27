// STRATUM INTELLIGENCE — DAILY + WEEKLY AUTOMATION
// FREE: Daily report every day at 09:10 AM Eastern
// PREMIUM: Daily + Financial Advisor weekly on Sundays
// All emails include: This is not financial advice disclaimer

const BEEHIIV_API_KEY = "kJyEvclzdorP6AW5YNMa8uklps7Qf7A2udcyhmunfcrgtKFB5REbcJN80pUWQyGh";
const PUBLICATION_ID  = "pub_e56de05e-80f8-4038-a362-228ee5a71b51";
const ANTHROPIC_KEY   = process.env.ANTHROPIC_API_KEY;
const fs   = require("fs");
const path = require("path");

const ARCHIVE_DIR = path.join(__dirname, "weekly_archive");
if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

function getET() { return new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" })); }
function pad(n) { return String(n).padStart(2, "0"); }
function isSunday() { return getET().getDay() === 0; }
function weekLabel() {
  const d = getET();
  const wk = d.getDate() <= 7 ? 1 : d.getDate() <= 14 ? 2 : d.getDate() <= 21 ? 3 : d.getDate() <= 28 ? 4 : 5;
  return "Week" + wk + "_" + d.toLocaleString("en-US",{month:"long"}) + "_" + d.getFullYear();
}
function readArchive() {
  const files = fs.readdirSync(ARCHIVE_DIR).filter(f => f.endsWith(".csv")).sort();
  if (!files.length) return "No archive data yet.";
  return files.map(f => "\n\n=== " + f + " ===\n" + fs.readFileSync(path.join(ARCHIVE_DIR, f), "utf8")).join("").slice(-40000);
}
function toHtml(text) {
  return text
    .replace(/^#{1,3} (.+)$/gm, "<h2 style='color:#F5C400;border-bottom:2px solid #F5C400;padding-bottom:8px;margin-top:32px'>$1</h2>")
    .replace(/\*\*(.+?)\*\*/g, "<strong style='color:#FFFFFF'>$1</strong>")
    .replace(/\n\n/g, "</p><p style='color:#CCCCCC;line-height:1.7'>")
    .replace(/\n/g, "<br>");
}

async function callClaude(system, user, maxTokens = 7000) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] })
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Claude: " + JSON.stringify(data));
  return data.content[0].text;
}

const DISCLAIMER = "<div style='background:#080808;border-top:1px solid #1A1A1A;padding:20px 24px;text-align:center'>" +
  "<p style='font-family:Arial,sans-serif;font-size:10px;color:#555555;line-height:1.8;max-width:600px;margin:0 auto'>" +
  "&#9888; DISCLAIMER: This is not financial advice. Stratum Intelligence is for informational purposes only. " +
  "Nothing published here constitutes financial advice, investment advice, or trading advice. " +
  "Stratum Intelligence is not a licensed financial advisor. Always consult a qualified financial professional " +
  "before making any investment decisions. Past performance is not indicative of future results." +
  "</p></div>";

async function sendToBeehiiv(subject, htmlBody, textBody, audience) {
  const html = "<div style='background:#0A0A0A;padding:0'>" +
    "<div style='background:#F5C400;padding:14px 32px;text-align:center'>" +
    "<span style='color:#0A0A0A;font-weight:bold;font-size:13px;letter-spacing:2px;font-family:Arial,sans-serif'>STRATUM INTELLIGENCE &nbsp;·&nbsp; " + (audience === "premium" ? "PREMIUM EDITION" : "DAILY BRIEFING") + "</span></div>" +
    "<div style='max-width:700px;margin:0 auto;padding:32px 24px;font-family:Arial,sans-serif'>" +
    "<p style='color:#CCCCCC;line-height:1.7'>" + htmlBody + "</p></div>" +
    "<div style='background:#F5C400;padding:14px 32px;text-align:center'>" +
    "<span style='color:#0A0A0A;font-size:12px;font-family:Arial,sans-serif'>MULTILINGUAL · BIAS-AWARE · CROSS-SIGNAL · 9:10 AM DAILY</span></div>" +
    DISCLAIMER + "</div>";

  const cr = await fetch("https://api.beehiiv.com/v2/publications/" + PUBLICATION_ID + "/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + BEEHIIV_API_KEY },
    body: JSON.stringify({ subject, content_html: html, content_text: textBody + "\n\n---\nDISCLAIMER: This is not financial advice. For informational purposes only.", status: "draft", audience })
  });
  const cd = await cr.json();
  if (!cr.ok) throw new Error("Beehiiv create: " + JSON.stringify(cd));
  const pr = await fetch("https://api.beehiiv.com/v2/publications/" + PUBLICATION_ID + "/posts/" + cd.data.id, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + BEEHIIV_API_KEY },
    body: JSON.stringify({ status: "confirmed" })
  });
  const pd = await pr.json();
  if (!pr.ok) throw new Error("Beehiiv publish: " + JSON.stringify(pd));
  console.log("Sent [" + audience + "]:", subject);
}

const DAILY_SYSTEM = "You are a multilingual adversarial market-intelligence engine. Find high-conviction cross-confirmed market-moving opportunities. Search daily in English, Simplified Chinese, Japanese, Arabic. Require 2+ confirmations. Layer every event: Observable Facts / Attribution Claims / Legitimacy Framing / Market-Relevant Residue. Action labels: BUY NOW / BUILD POSITION SLOWLY / WATCH TOO EARLY / WAIT ANOTHER WEEK / AVOID / CONTRARIAN WATCH / PROBABLY CROWDED / NO EDGE. Output SECTION 1 EXECUTIVE SNAPSHOT, SECTION 2 TOP 5 ACTIONABLE IDEAS, SECTION 3 CROSS-LANGUAGE DIVERGENCE TABLE, SECTION 4 CONGRESSIONAL POLITICAL TRADING WATCH, SECTION 5 POLICY AND PASS-PROBABILITY MAP, SECTION 6 GEOPOLITICAL MARKET MAP, SECTION 7 UNDERREPORTED IN ENGLISH, SECTION 8 OVERHYPED, SECTION 9 FINAL DECISION BOARD, SECTION 10 10-BULLET CLOSE. Then append: [WEEKLY_CSV_START] Date,Category,Subcategory,Content,Tag (all signals) [WEEKLY_CSV_END]. End every report with: THIS IS NOT FINANCIAL ADVICE. Stratum Intelligence is for informational and educational purposes only.";

const WEEKLY_SYSTEM = "You are the WEEKLY STOCK SELECTION AI. Read the weekly CSV archive and identify the best stock expressions of the week themes. Output SECTION 1 WEEKLY CORE THEMES, SECTION 1.5 SIGNAL REPETITION ANALYSIS, SECTION 2 TOP 10 SECTOR RANKING, SECTION 2.5 CONTRARIAN VIEW, SECTION 3 TOP 3 STOCKS PER SECTOR, SECTION 4 BEST STOCKS OF THE WEEK, SECTION 5 FALSE FITS, SECTION 6 FINAL DECISION BOARD, SECTION 7 CAPITAL ALLOCATION MODEL. Do NOT include Financial Advisor. End with: THIS IS NOT FINANCIAL ADVICE. Stratum Intelligence is for informational and educational purposes only.";

const FA_SYSTEM = "You are the FINANCIAL ADVISOR AI for PREMIUM SUBSCRIBERS ONLY. For every stock from the weekly selection produce full financial profiles: EPS, P/E, sector P/E, analyst consensus, price target, revenue growth, EPS trend, gross margin, net margin, ROE, FCF, debt/equity, net debt, insider ownership, institutional ownership, 52W position, dividend yield, financial verdict YES/CONDITIONAL/NO, final label STRONG BUY/BUY/HOLD/WEAK/AVOID. End with: THIS IS NOT FINANCIAL ADVICE. For informational purposes only.";

async function runDaily() {
  const today = getET().toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
  const label = getET().toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" });
  console.log("Running DAILY:", today);
  const raw = await callClaude(DAILY_SYSTEM, "Today is " + today + ". Generate the full Stratum Daily Market Intelligence Report across all required languages. Produce all 10 sections plus the WEEKLY ARCHIVE CSV.");
  const csvMatch = raw.match(/\[WEEKLY_CSV_START\]([\s\S]*?)\[WEEKLY_CSV_END\]/);
  if (csvMatch) {
    const weekFile = path.join(ARCHIVE_DIR, weekLabel() + ".csv");
    if (!fs.existsSync(weekFile)) fs.writeFileSync(weekFile, "Date,Category,Subcategory,Content,Tag\n");
    fs.appendFileSync(weekFile, csvMatch[1].trim() + "\n");
    console.log("Archive saved:", weekFile);
  }
  const report = raw.replace(/\[WEEKLY_CSV_START\][\s\S]*?\[WEEKLY_CSV_END\]/, "").trim();
  await sendToBeehiiv("Stratum Daily Intelligence — " + label, toHtml(report), report, "all");
  console.log("Daily done.");
}

async function runWeekly() {
  const today = getET().toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
  const label = getET().toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" });
  console.log("Running WEEKLY:", today);
  const archive = readArchive();
  const weeklyRaw = await callClaude(WEEKLY_SYSTEM, "Today is " + today + " (Sunday). Weekly archive:\n\n" + archive + "\n\nGenerate the full Stratum Weekly Stock Selection Report.", 8000);
  const freeHtml = toHtml(weeklyRaw) + "<div style='background:#1A1A1A;border:2px solid #F5C400;border-radius:8px;padding:24px;margin-top:32px;text-align:center'><p style='color:#F5C400;font-weight:bold;font-size:16px;margin:0 0 8px'>Upgrade to Stratum Premium — $10/month</p><p style='color:#CCCCCC;font-size:14px;margin:0'>Get the full Financial Advisor Deep Dive every Sunday.</p></div>";
  await sendToBeehiiv("Stratum Weekly — " + label, freeHtml, weeklyRaw, "free");
  const faRaw = await callClaude(FA_SYSTEM, "Based on this week stock selections:\n\n" + weeklyRaw + "\n\nGenerate full Financial Advisor profiles for every stock.", 6000);
  const premiumHtml = toHtml(weeklyRaw) + "<div style='background:#1A1A1A;border:2px solid #F5C400;border-radius:8px;padding:24px;margin-top:32px'><h2 style='color:#F5C400;margin-top:0'>PREMIUM: Financial Advisor Deep Dive</h2>" + toHtml(faRaw) + "</div>";
  await sendToBeehiiv("Stratum Weekly PREMIUM — " + label + " + Financial Advisor", premiumHtml, weeklyRaw + "\n\n---FA---\n\n" + faRaw, "premium");
  console.log("Weekly done.");
}

async function scheduler() {
  const et = getET();
  const h = et.getHours();
  const m = et.getMinutes();
  console.log("[" + h + ":" + pad(m) + " ET] Sunday:" + isSunday());
  if (h === 9 && m === 10) {
    try {
      await runDaily();
      if (isSunday()) await runWeekly();
    } catch (err) { console.error("Error:", err.message); }
    await new Promise(r => setTimeout(r, 61000));
  }
}

console.log("Stratum Intelligence started.");
console.log("Daily:  09:10 AM ET — all subscribers");
console.log("Weekly: 09:10 AM ET Sundays — free + premium with FA");
console.log("Disclaimer: THIS IS NOT FINANCIAL ADVICE — appended to all emails");
setInterval(scheduler, 30000);
scheduler();
