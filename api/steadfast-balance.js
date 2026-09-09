// Vercel Serverless Function — proxies Steadfast balance check
// Keeps STEADFAST_API_KEY / STEADFAST_SECRET_KEY server-side only

module.exports = async function handler(req, res) {
  try {
    const response = await fetch("https://portal.packzy.com/api/v1/get_balance", {
      headers: {
        "Api-Key": process.env.STEADFAST_API_KEY,
        "Secret-Key": process.env.STEADFAST_SECRET_KEY,
      },
    });
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    console.error("Steadfast balance fetch failed:", err);
    res.status(500).json({ error: "Failed to fetch balance" });
  }
};