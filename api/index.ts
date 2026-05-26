export default async function handler(req: Request): Promise<Response> {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  
  if (url.pathname === "/api" || url.pathname === "/") {
    return Response.json({ status: "ok", message: "Zero API running" }, { headers: corsHeaders });
  }

  return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
};
