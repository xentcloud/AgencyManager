/** Verify the HMAC the edge Worker attaches (see apps/edge/src/sign.ts). Rejects stale timestamps. */
export async function verifyEdgeRequest(request: Request, body: string): Promise<boolean> {
  const secret = process.env.EDGE_SHARED_SECRET;
  const ts = request.headers.get("x-edge-timestamp");
  const sig = request.headers.get("x-edge-signature");
  if (!secret || !ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ts}.${body}`)));
  const expected = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
