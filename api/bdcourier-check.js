// Vercel Serverless Function — checks customer delivery/fraud history via BD Courier
// Keeps BD_COURIER_API_KEY server-side only

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { phone } = req.body || {};

  if (!phone) {
    return res.status(400).json({ error: "Missing phone" });
  }

  try {
    const response = await fetch("https://api.bdcourier.com/courier-check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.BD_COURIER_API_KEY}`,
      },
      body: JSON.stringify({ phone }),
    });

    const data = await response.json();
    res.status(response.ok ? 200 : 400).json(data);
  } catch (err) {
    console.error("BD Courier fraud check failed:", err);
    res.status(500).json({ error: "Failed to check fraud history" });
  }
};