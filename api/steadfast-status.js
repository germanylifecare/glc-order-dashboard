// Vercel Serverless Function — checks Steadfast courier delivery status
// Keeps STEADFAST_API_KEY / STEADFAST_SECRET_KEY server-side only

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { consignment_id } = req.query || {};

  if (!consignment_id) {
    return res.status(400).json({ error: "Missing consignment_id" });
  }

  try {
    const response = await fetch(`https://portal.packzy.com/api/v1/status_by_cid/${consignment_id}`, {
      method: "GET",
      headers: {
        "Api-Key": process.env.STEADFAST_API_KEY,
        "Secret-Key": process.env.STEADFAST_SECRET_KEY,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    res.status(response.ok ? 200 : 400).json(data);
  } catch (err) {
    console.error("Steadfast status check failed:", err);
    res.status(500).json({ error: "Failed to check Steadfast status" });
  }
};