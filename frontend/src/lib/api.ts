// Same-origin requests are forwarded to Django by Next.js.
export async function getBackendHealth(): Promise<{ status: string; service: string }> {
  const response = await fetch("/api/health/", { cache: "no-store" });
  if (!response.ok) throw new Error(`Django API error: ${response.status}`);
  return response.json();
}
