import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import SharedMapView from './components/viewer/SharedMapView.jsx'
import LiveMapView from './components/viewer/LiveMapView.jsx'
import TradeShareView from './components/viewer/TradeShareView.jsx'
import { decodeMapFromParam } from './utils/exportShareLink.js'

// Section — shared-link routing. A URL like `...?map=<encoded>` (one-time,
// produced by the Share modal's "One-time" tab), `...?live=<id>` (produced
// by its "Live" tab), or `...?tradeShare=<id>` (produced by Trade
// Analysis's own Share button) should show ONLY that shared content — no
// top toolbar, no tabs bar, no side panels — with expand/collapse (or
// scrolling, for the trade viewer) as the only interaction. Deciding this
// here, before <App/> ever mounts, means the viewer never touches the
// visitor's own saved projects, auth session, or local/cloud autosave:
// none of that code runs at all in any of these branches.
function Root() {
  const params = new URLSearchParams(window.location.search)
  const mapParam = params.get('map')
  const liveParam = params.get('live')
  const tradeShareParam = params.get('tradeShare')

  if (tradeShareParam) {
    return <TradeShareView shareId={tradeShareParam} />
  }

  if (liveParam) {
    return <LiveMapView shareId={liveParam} />
  }

  if (mapParam) {
    const decoded = decodeMapFromParam(mapParam)
    if (decoded?.nodes) {
      return (
        <SharedMapView
          nodes={decoded.nodes}
          edges={decoded.edges || []}
          checklists={decoded.checklists || []}
          trades={decoded.trades || []}
          validationRules={decoded.validationRules || []}
          themeName={decoded.themeName}
        />
      )
    }
    // Malformed/corrupted link — fall back to a small message rather than
    // a blank screen or silently opening the visitor's own editor.
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#ecebe4] text-sm text-[#242423]">
        This share link looks broken or out of date.
      </div>
    )
  }

  return <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
