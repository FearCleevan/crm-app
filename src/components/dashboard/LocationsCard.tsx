import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { MoreHorizontal } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'

const LIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
const DARK_TILES  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

const LOCATIONS = [
  { flag: '🇦🇺', country: 'Australia',      lat: -25.27, lng: 133.78, pct: 48, color: '#6366f1', customers: 1248 },
  { flag: '🇮🇩', country: 'Indonesia',      lat: -0.79,  lng: 113.92, pct: 15, color: '#a855f7', customers: 390  },
  { flag: '🇸🇬', country: 'Singapore',      lat: 1.35,   lng: 103.82, pct: 7,  color: '#10b981', customers: 182  },
  { flag: '🇺🇸', country: 'United States',  lat: 37.09,  lng: -95.71, pct: 6,  color: '#f59e0b', customers: 156  },
  { flag: '🇬🇧', country: 'United Kingdom', lat: 55.38,  lng: -3.44,  pct: 5,  color: '#f43f5e', customers: 130  },
  { flag: '🇨🇦', country: 'Canada',         lat: 56.13,  lng: -106.35,pct: 4,  color: '#06b6d4', customers: 104  },
  { flag: '🇩🇪', country: 'Germany',        lat: 51.17,  lng: 10.45,  pct: 3,  color: '#84cc16', customers: 78   },
  { flag: '🇯🇵', country: 'Japan',          lat: 36.20,  lng: 138.25, pct: 3,  color: '#fb923c', customers: 78   },
  { flag: '🇮🇳', country: 'India',          lat: 20.59,  lng: 78.96,  pct: 2,  color: '#ec4899', customers: 52   },
  { flag: '🇧🇷', country: 'Brazil',         lat: -14.24, lng: -51.93, pct: 2,  color: '#facc15', customers: 52   },
]

const MAX_PCT = 48

export function LocationsCard() {
  const { theme } = useTheme()

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
          {LOCATIONS.map(loc => (
            <CircleMarker
              key={loc.country}
              center={[loc.lat, loc.lng]}
              radius={Math.max(5, Math.round((loc.pct / MAX_PCT) * 20))}
              pathOptions={{
                color: loc.color,
                fillColor: loc.color,
                fillOpacity: 0.7,
                weight: 1.5,
              }}
            >
              <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>
                <div className="text-xs font-semibold">
                  {loc.flag} {loc.country}
                  <br />
                  <span className="font-normal text-muted-foreground">
                    {loc.customers.toLocaleString()} customers ({loc.pct}%)
                  </span>
                </div>
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* Top 5 rankings */}
      <div className="space-y-2.5">
        {LOCATIONS.slice(0, 5).map((loc, i) => (
          <div key={loc.country} className="flex items-center gap-3">
            <span className="text-xs font-bold text-muted-foreground w-4 text-center">{i + 1}.</span>
            <span className="text-base leading-none">{loc.flag}</span>
            <span className="flex-1 text-sm text-foreground font-medium">{loc.country}</span>
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(loc.pct / MAX_PCT) * 100}%`, backgroundColor: loc.color }}
                />
              </div>
              <span className="text-xs font-semibold text-muted-foreground w-8 text-right">{loc.pct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
