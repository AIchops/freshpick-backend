// api/analyze.js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // set in Vercel, not in code
});

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    res.status(405).json({ error: "Only POST allowed" });
    return;
  }

  try {
    const { imageBase64, produce, daysUntilUse } = req.body;

    if (!imageBase64 || !produce || typeof daysUntilUse !== "number") {
      res.status(400).json({ error: "Missing fields" });
      return;
    }

    // Build a data URL for the image
    const dataUrl = `data:image/jpeg;base64,${imageBase64}`;

    const completion = await client.chat.completions.create({
      model: "o4-mini",
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "freshpick_schema",
          schema: {
            type: "object",
            properties: {
              label: { type: "string" },
              ripeness: { type: "string" },
              days_left: { type: "integer" },
              recommendation: { type: "string" },
              average_hue: { type: "number" },
              brightness: { type: "number" },
              dark_spots: { type: "number" }
            },
            required: ["label", "ripeness", "days_left", "recommendation"],
            additionalProperties: false
          },
          strict: true
        }
      },
      messages: [
        {
          role: "system",
          content:
            "You are FreshPick AI. You look at produce photos and help shoppers choose the best item based on when they plan to eat it. Be practical and cautious. Always remind users results are only estimates."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `The user is shopping for ${produce}. ` +
                `They plan to eat it in ${daysUntilUse} day(s). ` +
                "Look at the image. Estimate which items are suitable and how many days they have before they become overripe. " +
                "Return a JSON object following the schema: " +
                "label (like 'Tomato — Unripe'), ripeness, days_left (integer), recommendation (plain sentence to show in the app), " +
                "average_hue (0–360), brightness (0–1), dark_spots (0–1)."
            },
            {
              type: "image_url",
              image_url: {
                url: dataUrl
              }
            }
          ]
        }
      ],
      max_tokens: 400
    });

    const message = completion.choices[0].message;
    const resultJson = JSON.parse(message.content);

    res.status(200).json(resultJson);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
}
