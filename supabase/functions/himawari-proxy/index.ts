const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const sat = url.searchParams.get("sat") || "himawari";

  let target = "";
  if (sat === "himawari") target = "https://cdn.star.nesdis.noaa.gov/HIMAWARI9/ABI/FD/GEOCOLOR/1808x1808.jpg";
  if (sat === "meteosat") target = "https://cdn.star.nesdis.noaa.gov/METEOSAT11/ABI/FD/GEOCOLOR/1808x1808.jpg";
  if (sat === "iodc") target = "https://cdn.star.nesdis.noaa.gov/METEOSAT9/ABI/FD/GEOCOLOR/1808x1808.jpg";

  if (!target) {
    return new Response(
      JSON.stringify({ error: "Invalid satellite parameter" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const res = await fetch(target);
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Upstream fetch failed (${res.status})` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const buf = await res.arrayBuffer();

    return new Response(buf, {
      headers: {
        "Content-Type": "image/jpeg",
        ...corsHeaders,
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
