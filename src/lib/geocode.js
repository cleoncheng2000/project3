// Address search using OpenStreetMap Nominatim (free, max ~1 request/second).
export async function searchAddress(query) {
  const params = new URLSearchParams({ q: query, format: 'json', limit: '5' })
  const res = await fetch('https://nominatim.openstreetmap.org/search?' + params)
  if (!res.ok) throw new Error('Address search failed')
  const results = await res.json()
  return results.map((r) => ({
    label: r.display_name,
    lat: Number(r.lat),
    lng: Number(r.lon),
  }))
}
