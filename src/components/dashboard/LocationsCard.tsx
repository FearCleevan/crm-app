import { useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { MoreHorizontal } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import type { CountryPoint } from '@/services/analytics.service'

const LIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
const DARK_TILES  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

// Static geo + colour lookup — augmented with real count data at runtime
const GEO: Record<string, { lat: number; lng: number; flag: string; color: string }> = {
  'Australia':      { lat: -25.27, lng:  133.78, flag: '🇦🇺', color: '#6366f1' },
  'Indonesia':      { lat:  -0.79, lng:  113.92, flag: '🇮🇩', color: '#a855f7' },
  'Singapore':      { lat:   1.35, lng:  103.82, flag: '🇸🇬', color: '#10b981' },
  'United States':  { lat:  37.09, lng:  -95.71, flag: '🇺🇸', color: '#f59e0b' },
  'United Kingdom': { lat:  55.38, lng:   -3.44, flag: '🇬🇧', color: '#f43f5e' },
  'Canada':         { lat:  56.13, lng: -106.35, flag: '🇨🇦', color: '#06b6d4' },
  'Germany':        { lat:  51.17, lng:   10.45, flag: '🇩🇪', color: '#84cc16' },
  'Japan':          { lat:  36.20, lng:  138.25, flag: '🇯🇵', color: '#fb923c' },
  'India':          { lat:  20.59, lng:   78.96, flag: '🇮🇳', color: '#ec4899' },
  'Brazil':         { lat: -14.24, lng:  -51.93, flag: '🇧🇷', color: '#facc15' },
  'Philippines':    { lat:  12.88, lng:  121.77, flag: '🇵🇭', color: '#38bdf8' },
  'Malaysia':       { lat:   4.21, lng:  108.96, flag: '🇲🇾', color: '#fb7185' },
  'Thailand':       { lat:  15.87, lng:  100.99, flag: '🇹🇭', color: '#a3e635' },
  'Vietnam':        { lat:  14.06, lng:  108.28, flag: '🇻🇳', color: '#fbbf24' },
  'New Zealand':    { lat: -40.90, lng:  174.89, flag: '🇳🇿', color: '#34d399' },
  'South Korea':    { lat:  35.91, lng:  127.77, flag: '🇰🇷', color: '#818cf8' },
}

interface Props {
  countries?: CountryPoint[]
}

export function LocationsCard({ countries = [] }: Props) {
  const { theme } = useTheme()

  const locations = useMemo(() => {
    const total = countries.reduce((s, c) => s + Number(c.count), 0) || 1
    return countries
      .map(c => {
        const geo = GEO[c.country]
        return geo
          ? { country: c.country, count: Number(c.count), pct: Math.round((Number(c.count) / total) * 100), ...geo }
          : null
      })
      .filter(Boolean) as { country: string; count: number; pct: number; lat: number; lng: number; flag: string; color: string }[]
  }, [countries])

  const maxPct = locations[0]?.pct || 1

  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Top Customer Locations</p>
        <button type="button" aria-label="More options" className="h-7 w-7 rounded-lg hover:bg-accent flex items-center justify-center transition-colors">
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Interactive map */}
      <div className="h-48 rounded-lg overflow-hidden border border-border location-map-container">
        <MapContainer
          center={[20, 20]}
          zoom={1.5}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
          attributionControl={false}
          zoomControl={false}
        >
          <TileLayer
            key={theme}
            url={theme === 'dark' ? DARK_TILES : LIGHT_TILES}
            attribution={ATTRIBUTION}
          />
          {locations.map(loc => (
            <CircleMarker
              key={loc.country}
              center={[loc.lat, loc.lng]}
              radius={Math.max(5, Math.round((loc.pct / maxPct) * 20))}
              pathOptions={{ color: loc.color, fillColor: loc.color, fillOpacity: 0.7, weight: 1.5 }}
            >
              <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>
                <div className="text-xs font-semibold">
                  {loc.flag} {loc.country}
                  <br />
                  <span className="font-normal text-muted-foreground">
                    {loc.count.toLocaleString()} prospects ({loc.pct}%)
                  </span>
                </div>
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* Top 5 rankings */}
      {locations.length === 0 ? (
        <div className="py-4 text-center text-sm text-muted-foreground">No location data yet</div>
      ) : (
        <div className="space-y-2.5">
          {locations.slice(0, 5).map((loc, i) => (
            <div key={loc.country} className="flex items-center gap-3">
              <span className="text-xs font-bold text-muted-foreground w-4 text-center">{i + 1}.</span>
              <span className="text-base leading-none">{loc.flag}</span>
              <span className="flex-1 text-sm text-foreground font-medium">{loc.country}</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(loc.pct / maxPct) * 100}%`, backgroundColor: loc.color }}
                  />
                </div>
                <span className="text-xs font-semibold text-muted-foreground w-8 text-right">{loc.pct}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
