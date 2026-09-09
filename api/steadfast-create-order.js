// Vercel Serverless Function — creates a Steadfast courier shipment
// Keeps STEADFAST_API_KEY / STEADFAST_SECRET_KEY server-side only

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { invoice, recipient_name, recipient_phone, recipient_address, cod_amount, note } = req.body || {};

  if (!invoice || !recipient_name || !recipient_phone || !recipient_address || cod_amount === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const response = await fetch("https://portal.packzy.com/api/v1/create_order", {
      method: "POST",
      headers: {
        "Api-Key": process.env.STEADFAST_API_KEY,
        "Secret-Key": process.env.STEADFAST_SECRET_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        invoice: String(invoice),
        recipient_name,
        recipient_phone,
        recipient_address,
        cod_amount,
        note: note || "",
      }),
    });

    const data = await response.json();
    res.status(response.ok ? 200 : 400).json(data);
  } catch (err) {
    console.error("Steadfast create_order failed:", err);
    res.status(500).json({ error: "Failed to create Steadfast order" });
  }
};