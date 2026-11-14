// Use your computer's LAN address for a physical phone, never localhost.
const apiUrl = process.env.EXPO_PUBLIC_API_URL;

export async function getBackendHealth(): Promise<{ status: string; service: string }> {
  if (!apiUrl) throw new Error('Set EXPO_PUBLIC_API_URL in mobile/.env');
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/health/`);
  if (!response.ok) throw new Error(`Django API error: ${response.status}`);
  return response.json();
}
