// ============================================================
//  STRATUM DAILY + WEEKLY AUTOMATION
//  Bassam's Newsletter — beehiiv
// ============================================================
//  SCHEDULE:
//  Daily report  → every day at 09:10 AM (Eastern)
//  Weekly report → every Sunday at 09:10 AM (Eastern)
//
//  Daily saves a CSV archive that Weekly reads from.
// ============================================================

const BEEHIIV_API_KEY  = "kJyEvclzdorP6AW5YNMa8uklps7Qf7A2udcyhmunfcrgtKFB5REbcJN80pUWQyGh";
const PUBLICATION_ID   = "pub_e56de05e-80f8-4038-a362-228ee5a71b51";
const ANTHROPIC_KEY    = process.env.ANTHROPIC_API_KEY;
const fs               = require("fs");
const path             = require("path");

// ── ARCHIVE FOLDER ─────────────────────────────────────────
const ARCHIVE_DIR = path.join(__dirname, "weekly_archive");
if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

// ── HELPERS ────────────────────────────────────────────────
function getEasternTime() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
}

function pad(n) { return String(n).padStart(2, "0"); }

function todayLabel() {
  const d = getEasternTime();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function weekLabel() {
  const d   = getEasternTime();
  const day = d.getDate();
  const wk  = day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : day <= 28 ? 4 : 5;
  const mon = d.toLocaleString("en-US", { month: "long" });
  return `Week${wk}_${mon}_${d.getFullYear()}`;
}

function isSunday() { return getEasternTime().getDay() === 0; }

// ── READ WEEKLY ARCHIVE CSVs ────────────────────────────────
function readWeeklyArchive() {
  const files = fs.readdirSync(ARCHIVE_DIR)
    .filter(f => f.endsWith(".csv"))
    .sort();
  if (!files.length) return "No archive data yet.";
  let combined = "";
  for (const f of files) {
    combined += `\n\n=== ${f} ===\n`;
    combined += fs.readFileSync(path.join(ARCHIVE_DIR, f), "utf8");
  }
  return combined.slice(-40000); // last 40k chars to stay in context
}

// ── CLAUDE API CALL ────────────────────────────────────────
async function callClaude(systemPrompt, userMessage, maxTokens = 7000) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }]
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Claude error: " + JSON.stringify(data));
  return data.content[0].text;
}

// ── BEEHIIV SEND ────────────────────────────────────────────
async function sendToBeehiiv(subject, htmlContent, textContent) {
  const createRes = await fetch(
    `https://api.beehiiv.com/v2/publications/${PUBLICATION_ID}/posts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${BEEHIIV_API_KEY}`
      },
      body: JSON.stringify({
        subject,
        content_html: `<div style="font-family:sans-serif;max-width:700px;margin:0 auto;line-height:1.6">${htmlContent}</div>`,
        content_text: textContent,
        status: "draft",
        audience: "all"
      })
    }
  );
  const postData = await createRes.json();
  if (!createRes.ok) throw new Error("Beehiiv create error: " + JSON.stringify(postData));
  const postId = postData.data.id;
  console.log("Draft created:", postId);

  const pubRes = await fetch(
    `https://api.beehiiv.com/v2/publications/${PUBLICATION_ID}/posts/${postId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${BEEHIIV_API_KEY}`
      },
      body: JSON.stringify({ status: "confirmed" })
    }
  );
  const pubData = await pubRes.json();
  if (!pubRes.ok) throw new Error("Beehiiv publish error: " + JSON.stringify(pubData));
  console.log("Sent to all subscribers:", subject);
}

// ── DAILY REPORT ────────────────────────────────────────────
const DAILY_SYSTEM_PROMPT = `You are my multilingual, adversarial, market-intelligence engine.
Your job is not to summarize news.
Your job is to find high-conviction, cross-confirmed, market-moving opportunities and risks by combining:
1. financial news, 2. macro data, 3. geopolitical events, 4. policy and regulatory developments,
5. congressional and political trading activity, 6. commodity reactions, 7. sector and stock reactions,
8. cross-language narrative differences, 9. contradiction checks, 10. timing and conviction analysis.

You must think like a geopolitical analyst, macro strategist, policy analyst, congressional-trading watcher,
sector mapper, skeptical forensic auditor, and disciplined portfolio analyst.

SEARCH LANGUAGES EVERY DAY: English, Simplified Chinese, Japanese, Arabic (Korean, German, Spanish, Russian when relevant).

NON-NEGOTIABLE RULES:
1. NEVER treat one country's narrative as objective truth.
2. NEVER force certainty when sources conflict.
3. NEVER call something insider trading without hard evidence — use: unusual alignment, suspicious timing, possible informational edge, politically adjacent positioning, notable pre-positioning.
4. NEVER recommend from one weak signal. Require 2+ independent confirmations for high conviction.
5. DISTINGUISH: observable facts / attribution claims / legitimacy framing / propaganda / market-relevant consequences.
6. For every major event break into LAYER 1 (Observable Facts) / LAYER 2 (Attribution Claims) / LAYER 3 (Legitimacy Framing) / LAYER 4 (Market-Relevant Residue).
7. Score every serious claim: Truth Confidence 0-10, Market Relevance 0-10.

ACTION LABELS (use exactly): BUY NOW / BUILD POSITION SLOWLY / WATCH TOO EARLY / WAIT ANOTHER WEEK / AVOID / CONTRARIAN WATCH / PROBABLY CROWDED / NO EDGE

OUTPUT FORMAT — produce ALL of these sections:
SECTION 1: EXECUTIVE SNAPSHOT (regime, top drivers, bottom line)
SECTION 2: TOP 5 ACTIONABLE IDEAS (full analysis per idea including score, confidence, decision, invalidation)
SECTION 3: CROSS-LANGUAGE DIVERGENCE TABLE
SECTION 4: CONGRESSIONAL / POLITICAL TRADING WATCH
SECTION 5: POLICY AND PASS-PROBABILITY MAP
SECTION 6: GEOPOLITICAL MARKET MAP
SECTION 7: WHAT LOOKS UNDERREPORTED IN ENGLISH (3-5 items)
SECTION 8: WHAT LOOKS OVERHYPED (3-5 items)
SECTION 9: FINAL DECISION BOARD
SECTION 10: 10-BULLET CLOSE

After the main report, append a WEEKLY ARCHIVE ENTRY in CSV format with columns:
Date,Category,Subcategory,Content,Tag
Include ALL meaningful signals — do not compress aggressively.
Mark the CSV section clearly as: [WEEKLY_CSV_START] ... [WEEKLY_CSV_END]

Be concise but sharp. Analytical, not theatrical. Direct language. State uncertainty clearly.`;

async function runDaily() {
  const today = getEasternTime().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
  console.log("Running DAILY report for", today);

  const content = await callClaude(
    DAILY_SYSTEM_PROMPT,
    `Today is ${today}. Generate the full Stratum Daily Market Intelligence Report. Search across all required languages and domains. Produce all 10 sections plus the WEEKLY ARCHIVE CSV entry.`
  );

  // ── Extract and save CSV archive ──────────────────────────
  const csvMatch = content.match(/\[WEEKLY_CSV_START\]([\s\S]*?)\[WEEKLY_CSV_END\]/);
  if (csvMatch) {
    const csvData   = csvMatch[1].trim();
    const weekFile  = path.join(ARCHIVE_DIR, `${weekLabel()}.csv`);
    const header    = "Date,Category,Subcategory,Content,Tag\n";
    if (!fs.existsSync(weekFile)) fs.writeFileSync(weekFile, header);
    fs.appendFileSync(weekFile, csvData + "\n");
    console.log("Archive appended to", weekFile);
  } else {
    console.warn("No CSV block found in daily output — archive not updated.");
  }

  // ── Build clean email HTML ────────────────────────────────
  const reportOnly = content.replace(/\[WEEKLY_CSV_START\][\s\S]*?\[WEEKLY_CSV_END\]/, "").trim();
  const htmlContent = reportOnly
    .replace(/^#{1,3} (.+)$/gm, "<h2>$1</h2>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  const dateLabel = getEasternTime().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  await sendToBeehiiv(
    `Stratum Daily Intelligence — ${dateLabel}`,
    `<p>${htmlContent}</p>`,
    reportOnly
  );

  console.log("Daily complete.");
}

// ── WEEKLY REPORT ───────────────────────────────────────────
const WEEKLY_SYSTEM_PROMPT = `You are the WEEKLY STOCK SELECTION AI.
You do NOT perform weekly news discovery.
The weekly CSV archive already contains the week's context, event flow, signal development, cross-language observations, weak signals, contradictions, and sector implications.

Your job:
1. Read the weekly archive carefully.
2. Determine which sectors/themes mattered most that week.
3. Rank sectors by conviction and investability.
4. Research the stocks inside those sectors.
5. Identify the best stock expressions of the week's themes.

For every serious stock candidate analyze: direct exposure, revenue linkage, geographic relevance, first vs second order, crowding, timing edge, invalidation.
Also analyze policy/political signals: legislation, congressional trading, timing before catalysts.

OUTPUT SECTIONS:
SECTION 1: WEEKLY CORE THEMES (top 5 themes, what strengthened, weakened, is noise, remains investable)
SECTION 1.5: SIGNAL REPETITION ANALYSIS (days appeared, strengthened/weakened, confirmation)
SECTION 2: TOP 10 SECTOR RANKING (rank, why, archive support, strengthening/fading, investability 0-10, decision)
SECTION 2.5: CONTRARIAN VIEW (most likely wrong consensus)
SECTION 3: TOP 3 STOCKS PER SECTOR (ticker, company, fit, exposure, order, timing, crowding, risks, why better, decision)
SECTION 4: BEST STOCKS OF THE WEEK (top 10 overall ranked)
SECTION 5: FALSE FITS / BAD STOCK PICKS
SECTION 6: FINAL DECISION BOARD
SECTION 7: CAPITAL ALLOCATION MODEL (% per sector, % per stock)

After sections, produce FINANCIAL ADVISOR output for every stock: EPS, P/E, sector P/E, analyst consensus, price target, revenue growth, EPS trend, gross margin, net margin, ROE, FCF, debt/equity, net debt, insider ownership, institutional ownership, 52W position, dividend yield, financial verdict, final label.

Final labels must be exactly: STRONG BUY / BUY / HOLD / WEAK / AVOID
52W position exactly: NEAR HIGH / MID RANGE / NEAR LOW

Be sharp, selective, skeptical. Fact-check exposure. Do not pick famous names lazily.`;

async function runWeekly() {
  const today = getEasternTime().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
  console.log("Running WEEKLY report for", today);

  const archiveData = readWeeklyArchive();
  const content = await callClaude(
    WEEKLY_SYSTEM_PROMPT,
    `Today is ${today} (Sunday). Here is the full weekly archive from this week:\n\n${archiveData}\n\nGenerate the complete Stratum Weekly Stock Selection Report based on this archive.`,
    8000
  );

  const htmlContent = content
    .replace(/^#{1,3} (.+)$/gm, "<h2>$1</h2>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  const dateLabel = getEasternTime().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  await sendToBeehiiv(
    `Stratum Weekly Stock Selection — ${dateLabel}`,
    `<p>${htmlContent}</p>`,
    content
  );

  console.log("Weekly complete.");
}

// ── SCHEDULER ───────────────────────────────────────────────
// Runs every minute, checks if it's time to fire
function getMinutesUntil(targetHour, targetMinute) {
  const now = getEasternTime();
  const target = new Date(now);
  target.setHours(targetHour, targetMinute, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return Math.round((target - now) / 60000);
}

async function scheduler() {
  const et = getEasternTime();
  const h  = et.getHours();
  const m  = et.getMinutes();

  console.log(`[Scheduler] Eastern: ${h}:${pad(m)} | Sunday: ${isSunday()}`);

  // Fire at exactly 09:10
  if (h === 9 && m === 10) {
    try {
      await runDaily();
      if (isSunday()) await runWeekly();
    } catch (err) {
      console.error("Run error:", err.message);
    }
    // Wait 61 seconds to avoid double-firing in the same minute
    await new Promise(r => setTimeout(r, 61000));
  }
}

// ── MAIN ────────────────────────────────────────────────────
console.log("Stratum automation started.");
console.log("Daily:  09:10 AM Eastern every day");
console.log("Weekly: 09:10 AM Eastern every Sunday");
console.log("Archive folder:", ARCHIVE_DIR);

// Check every 30 seconds
setInterval(scheduler, 30000);
scheduler(); // run once on startup to log current time
