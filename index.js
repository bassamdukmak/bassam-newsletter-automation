const BEEHIIV_API_KEY = "kJyEvclzdorP6AW5YNMa8uklps7Qf7A2udcyhmunfcrgtKFB5REbcJN80pUWQyGh";
const PUBLICATION_ID  = "pub_e56de05e-80f8-4038-a362-228ee5a71b51";
const ANTHROPIC_KEY   = process.env.ANTHROPIC_API_KEY;

async function generateNewspaper() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: `You are the editor of a daily AI newspaper. Today is ${today}. Research and write today's edition. Include top 3-5 AI news stories, a brief summary of each, and why it matters. Format cleanly for email. Use clear headings. No preamble or sign-off.`
      }]
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error("AI error: " + JSON.stringify(data));
  console.log("Newspaper generated successfully");
  return data.content[0].text;
}

async function sendToBeehiiv(content) {
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const subject = "The Daily AI — " + today;
  const createResponse = await fetch(
    "https://api.beehiiv.com/v2/publications/" + PUBLICATION_ID + "/posts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + BEEHIIV_API_KEY },
      body: JSON.stringify({
        subject: subject,
        content_html: "<div style='font-family:sans-serif;max-width:600px;margin:0 auto'>" + content.replace(/\n/g, "<br>") + "</div>",
        content_text: content,
        status: "draft",
        audience: "all"
      })
    }
  );
  const postData = await createResponse.json();
  if (!createResponse.ok) throw new Error("Beehiiv error: " + JSON.stringify(postData));
  const postId = postData.data.id;
  console.log("Draft created: " + postId);
  const publishResponse = await fetch(
    "https://api.beehiiv.com/v2/publications/" + PUBLICATION_ID + "/posts/" + postId,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + BEEHIIV_API_KEY },
      body: JSON.stringify({ status: "confirmed" })
    }
  );
  const publishData = await publishResponse.json();
  if (!publishResponse.ok) throw new Error("Publish error: " + JSON.stringify(publishData));
  console.log("Newsletter sent! Subject: " + subject);
}

async function runAutomation() {
  console.log("Starting Daily AI Newspaper automation...");
  try {
    const newspaper = await generateNewspaper();
    await sendToBeehiiv(newspaper);
    console.log("Done! Newsletter sent to Bassam subscribers.");
  } catch (err) {
    console.error("Automation failed:", err.message);
    process.exit(1);
  }
}

runAutomation();
