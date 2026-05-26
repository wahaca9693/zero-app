import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { method, query } = req;
    const path = Array.isArray(query?.route) ? query.route[0] : (query?.route || "/");
    
    // Health check
    if (path === "/" || path === "") {
      return res.json({ status: "ok", message: "Zero API running" });
    }

    return res.json({ error: "Endpoint not found" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
