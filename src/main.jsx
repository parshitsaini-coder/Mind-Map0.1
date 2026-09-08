import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import SharedMapView from './components/viewer/SharedMapView.jsx'
import { decodeMapFromParam } from './utils/exportShareLink.js'

// Section — shared-link routing. A URL like `...?map=<encoded>` (produced by
// the share button in the toolbar) should show ONLY the mind map — no top
// toolbar, no tabs bar, no side panels — with expand/collapse as the only
// interaction. Deciding this here, before <App/> ever mounts, means the
// viewer never touches the visitor's own saved projects, auth session, or
// local/cloud autosave: none of that code runs at all in this branch.
function Root() {
  const params = new URLSearchParams(window.location.search)
  const mapParam = params.get('map')

  if (mapParam) {
    const decoded = decodeMapFromParam(mapParam)
    if (decoded?.nodes) {
      return <SharedMapView nodes={decoded.nodes} edges={decoded.edges || []} />
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
