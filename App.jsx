import React, { useMemo, useRef, useState } from 'react';

const BRAND = {
  blue: '#1f6fb8',
  charcoal: '#1f2933',
  grey: '#aab2ba',
  light: '#eef2f5',
  paper: '#ffffff',
};

const SYMBOLS = [
  { id: 'gpo', label: 'GPO', short: 'GPO', category: 'power' },
  { id: 'dbl_gpo', label: 'Double GPO', short: '2GPO', category: 'power' },
  { id: 'ext_gpo', label: 'External GPO', short: 'EXT', category: 'power' },
  { id: 'floor_box', label: 'Floor Box', short: 'FB', category: 'power' },
  { id: 'switch', label: 'Switch', short: 'S', category: 'switching' },
  { id: '2gang', label: '2 Gang', short: '2G', category: 'switching' },
  { id: '2way', label: '2 Way', short: '2W', category: 'switching' },
  { id: 'dimmer', label: 'Dimmer', short: 'DIM', category: 'switching' },
  { id: 'downlight', label: 'Downlight', short: 'DL', category: 'lighting' },
  { id: 'pendant', label: 'Pendant', short: 'P', category: 'lighting' },
  { id: 'strip', label: 'LED Strip', short: 'LED', category: 'lighting' },
  { id: 'feature', label: 'Feature Light', short: 'FL', category: 'lighting' },
  { id: 'ext_light', label: 'External Light', short: 'EL', category: 'lighting' },
  { id: 'data', label: 'Data', short: 'DATA', category: 'services' },
  { id: 'tv', label: 'TV', short: 'TV', category: 'services' },
  { id: 'cctv', label: 'CCTV', short: 'CCTV', category: 'services' },
  { id: 'intercom', label: 'Intercom', short: 'INT', category: 'services' },
  { id: 'wifi', label: 'WiFi Point', short: 'WIFI', category: 'services' },
  { id: 'smoke', label: 'Smoke Alarm', short: 'SA', category: 'compliance' },
  { id: 'exhaust', label: 'Exhaust Fan', short: 'EF', category: 'compliance' },
  { id: 'isolator', label: 'Isolator', short: 'ISO', category: 'compliance' },
];

const CATEGORIES = ['power', 'switching', 'lighting', 'services', 'compliance'];
const DEFAULT_CHECKLIST = [
  'Confirm island, pantry and appliance cupboard power',
  'Check switch positions against door swings and joinery',
  'Verify smoke alarm layout',
  'Review external lighting, GPOs and weatherproof fittings',
  'Confirm vanity, mirror light and heated towel rail provisions',
  'Confirm garage motor, freezer and EV charging allowance',
  'Check data / TV / Wi-Fi points before close-up',
];

function distancePointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function hitTest(shape, x, y) {
  if (shape.type === 'symbol') return Math.hypot(x - shape.x, y - shape.y) < 24;
  if (shape.type === 'callout') return x >= shape.x - 18 && x <= shape.x + 240 && y >= shape.y - 40 && y <= shape.y + 16;
  if (shape.type === 'text') return x >= shape.x && x <= shape.x + 220 && y >= shape.y - 30 && y <= shape.y + 6;
  if (shape.type === 'line') return distancePointToSegment(x, y, shape.x1, shape.y1, shape.x2, shape.y2) < 12;
  return false;
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function App() {
  const fileInputRef = useRef(null);
  const svgRef = useRef(null);

  const [builderName, setBuilderName] = useState('R J Hill Homes');
  const [projectName, setProjectName] = useState('Electrical Review');
  const [clientName, setClientName] = useState('Client Name');
  const [planRevision, setPlanRevision] = useState('Rev A');
  const [imageSrc, setImageSrc] = useState(null);
  const [tool, setTool] = useState('symbol');
  const [activeCategory, setActiveCategory] = useState('power');
  const [selectedSymbolId, setSelectedSymbolId] = useState('dbl_gpo');
  const [textValue, setTextValue] = useState('Check with client');
  const [calloutText, setCalloutText] = useState('Confirm before rough-in');
  const [siteNotes, setSiteNotes] = useState('Builder notes:\n- Coordinate with joinery\n- Confirm feature lighting heights\n- Review external lighting with landscape plan');
  const [checklist, setChecklist] = useState(DEFAULT_CHECKLIST.map((text) => ({ text, done: false })));
  const [markups, setMarkups] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [visibleLayers, setVisibleLayers] = useState({ power: true, switching: true, lighting: true, services: true, compliance: true, notes: true });
  const canvasSize = { width: 1600, height: 1000 };

  const selectedSymbol = useMemo(() => SYMBOLS.find((s) => s.id === selectedSymbolId) || SYMBOLS[0], [selectedSymbolId]);
  const filteredSymbols = useMemo(() => SYMBOLS.filter((s) => s.category === activeCategory), [activeCategory]);
  const selectedItem = useMemo(() => markups.find((m) => m.id === selectedId) || null, [markups, selectedId]);
  const variations = useMemo(() => markups.filter((m) => m.variation), [markups]);
  const variationTotal = useMemo(() => variations.reduce((sum, v) => sum + Number(v.cost || 0), 0), [variations]);

  const getPoint = (event) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvasSize.width,
      y: ((event.clientY - rect.top) / rect.height) * canvasSize.height,
    };
  };

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setImageSrc(e.target?.result || null);
    reader.readAsDataURL(file);
  };

  const placeMarkup = (event) => {
    const pt = getPoint(event);

    if (tool === 'select') {
      const hit = [...markups].reverse().find((shape) => hitTest(shape, pt.x, pt.y));
      setSelectedId(hit?.id || null);
      return;
    }

    if (tool === 'symbol') {
      const item = {
        id: crypto.randomUUID(),
        type: 'symbol',
        x: pt.x,
        y: pt.y,
        short: selectedSymbol.short,
        label: selectedSymbol.label,
        category: selectedSymbol.category,
        layer: selectedSymbol.category,
        variation: false,
        description: '',
        cost: '',
        trade: 'Electrical',
        status: 'pending',
      };
      setMarkups((prev) => [...prev, item]);
      setSelectedId(item.id);
      return;
    }

    if (tool === 'text') {
      const item = {
        id: crypto.randomUUID(),
        type: 'text',
        x: pt.x,
        y: pt.y,
        text: textValue,
        layer: 'notes',
        variation: false,
        description: '',
        cost: '',
        trade: 'Electrical',
        status: 'pending',
      };
      setMarkups((prev) => [...prev, item]);
      setSelectedId(item.id);
      return;
    }

    if (tool === 'callout') {
      const number = markups.filter((m) => m.type === 'callout').length + 1;
      const item = {
        id: crypto.randomUUID(),
        type: 'callout',
        x: pt.x,
        y: pt.y,
        number,
        text: calloutText,
        layer: 'notes',
        variation: true,
        description: calloutText,
        cost: '',
        trade: 'Electrical',
        status: 'pending',
      };
      setMarkups((prev) => [...prev, item]);
      setSelectedId(item.id);
    }
  };

  const updateItem = (id, field, value) => setMarkups((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  const deleteSelected = () => {
    if (!selectedId) return;
    setMarkups((prev) => prev.filter((m) => m.id !== selectedId));
    setSelectedId(null);
  };
  const toggleChecklist = (index) => setChecklist((prev) => prev.map((item, i) => (i === index ? { ...item, done: !item.done } : item)));

  const saveReview = () => {
    const payload = { builderName, projectName, clientName, planRevision, siteNotes, checklist, markups, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName.toLowerCase().replace(/\s+/g, '-') || 'review'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportVariations = () => {
    const content = `R J Hill Homes\nVariation Approval Summary\n\nProject: ${projectName}\nClient: ${clientName}\n\n${variations
      .map((v, i) => `${i + 1}. ${v.label || v.type}\nDescription: ${v.description || ''}\nTrade: ${v.trade || 'Electrical'}\nCost: $${v.cost || 0}\nStatus: ${v.status || 'pending'}\n`)
      .join('\n')}\nTotal Variation Value: $${variationTotal}\n\nClient Signature: ____________________\nDate: ____________________`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName || 'project'}-variation-approval.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPrintPack = () => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgEl);
    const approvedCount = variations.filter((m) => m.status === 'approved').length;
    const pendingCount = variations.filter((m) => (m.status || 'pending') === 'pending').length;
    const rejectedCount = variations.filter((m) => m.status === 'rejected').length;

    const variationRows = variations.length
      ? variations.map((item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(item.label || item.type)}</td>
            <td>${escapeHtml(item.description || item.text || '')}</td>
            <td>${escapeHtml(item.trade || 'Electrical')}</td>
            <td>$${escapeHtml(item.cost || 0)}</td>
            <td>${escapeHtml(item.status || 'pending')}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="6" style="text-align:center;color:#64748b;">No tagged variations</td></tr>';

    const printWindow = window.open('', '_blank', 'width=1400,height=900');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${escapeHtml(projectName)} - A3 Electrical Review</title>
          <style>
            @page { size: A3 landscape; margin: 10mm; }
            body { font-family: Arial, Helvetica, sans-serif; color: #1f2933; margin: 0; }
            .sheet { padding: 8mm; box-sizing: border-box; }
            .header { display: flex; justify-content: space-between; align-items: stretch; gap: 12px; margin-bottom: 12px; }
            .brand { flex: 1; border: 2px solid #1f2933; border-radius: 14px; padding: 14px 18px; }
            .brand-top { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
            .brand-mark { width: 42px; height: 42px; background: #1f6fb8; color: white; display: flex; align-items: center; justify-content: center; border-radius: 12px; font-weight: 800; }
            .brand-title { font-size: 24px; font-weight: 800; }
            .brand-sub { font-size: 13px; color: #52606d; }
            .meta { width: 340px; border: 2px solid #1f2933; border-radius: 14px; padding: 14px 18px; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; font-size: 12px; }
            .meta-label { color: #52606d; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
            .content { display: grid; grid-template-columns: 1.55fr 0.8fr; gap: 12px; }
            .panel { border: 2px solid #cbd5e1; border-radius: 16px; overflow: hidden; background: white; }
            .panel-title { padding: 10px 14px; background: #f8fafc; font-weight: 800; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
            .plan-wrap { padding: 10px; }
            .legend-wrap, .notes-wrap, .summary-wrap, .variation-wrap { padding: 12px 14px; }
            .legend-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
            .legend-item { border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 10px; font-size: 11px; }
            .legend-short { font-weight: 800; color: #1f6fb8; display: block; margin-bottom: 2px; }
            .note-box { white-space: pre-wrap; font-size: 12px; line-height: 1.45; color: #334155; }
            .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
            .summary-card { border: 1px solid #dbe2ea; border-radius: 12px; padding: 10px; }
            .summary-value { font-size: 18px; font-weight: 800; }
            .summary-label { font-size: 11px; color: #64748b; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border-top: 1px solid #e2e8f0; padding: 8px 6px; vertical-align: top; text-align: left; }
            th { background: #f8fafc; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #52606d; }
            .footer { margin-top: 10px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; }
            .signature { margin-top: 22px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
            .sig-line { border-top: 1px solid #1f2933; padding-top: 6px; font-size: 11px; }
            svg { width: 100%; height: auto; display: block; background: white; }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="header">
              <div class="brand">
                <div class="brand-top">
                  <div class="brand-mark">HH</div>
                  <div>
                    <div class="brand-title">${escapeHtml(builderName)}</div>
                    <div class="brand-sub">Electrical review · client selections · variation tracking</div>
                  </div>
                </div>
                <div style="font-size:14px;font-weight:700;">${escapeHtml(projectName)}</div>
              </div>
              <div class="meta">
                <div class="meta-grid">
                  <div><div class="meta-label">Client</div><div>${escapeHtml(clientName)}</div></div>
                  <div><div class="meta-label">Revision</div><div>${escapeHtml(planRevision)}</div></div>
                  <div><div class="meta-label">Date</div><div>${new Date().toLocaleDateString()}</div></div>
                  <div><div class="meta-label">Variation Total</div><div><strong>$${variationTotal}</strong></div></div>
                </div>
              </div>
            </div>
            <div class="content">
              <div class="panel"><div class="panel-title">Marked-Up Electrical Plan</div><div class="plan-wrap">${svgString}</div></div>
              <div style="display:flex;flex-direction:column;gap:12px;">
                <div class="panel"><div class="panel-title">Legend</div><div class="legend-wrap"><div class="legend-grid">${SYMBOLS.map((symbol) => `<div class="legend-item"><span class="legend-short">${symbol.short}</span>${symbol.label}</div>`).join('')}</div></div></div>
                <div class="panel"><div class="panel-title">Builder Notes</div><div class="notes-wrap"><div class="note-box">${escapeHtml(siteNotes)}</div></div></div>
              </div>
            </div>
            <div class="panel" style="margin-top:12px;"><div class="panel-title">Variation Summary</div><div class="summary-wrap"><div class="summary-cards"><div class="summary-card"><div class="summary-value">${variations.length}</div><div class="summary-label">Tagged Variations</div></div><div class="summary-card"><div class="summary-value">${approvedCount}</div><div class="summary-label">Approved</div></div><div class="summary-card"><div class="summary-value">${pendingCount}</div><div class="summary-label">Pending</div></div><div class="summary-card"><div class="summary-value">${rejectedCount}</div><div class="summary-label">Rejected</div></div></div></div></div>
            <div class="panel" style="margin-top:12px;"><div class="panel-title">Variation Approval Schedule</div><div class="variation-wrap"><table><thead><tr><th>#</th><th>Item</th><th>Description</th><th>Trade</th><th>Cost</th><th>Status</th></tr></thead><tbody>${variationRows}</tbody></table><div class="signature"><div class="sig-line">Client signature</div><div class="sig-line">Date</div></div></div></div>
            <div class="footer"><div>${escapeHtml(builderName)}</div><div>Generated from iPad Electrical Review Tool</div></div>
          </div>
          <script>window.onload=function(){setTimeout(function(){window.print();},300);};</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const drawMarkup = (item) => {
    if (item.layer && !visibleLayers[item.layer]) return null;

    if (item.type === 'symbol') {
      const stroke = item.variation ? '#ffffff' : BRAND.charcoal;
      return (
        <g key={item.id}>
          <circle cx={item.x} cy={item.y} r="20" fill={item.variation ? BRAND.blue : '#ffffff'} stroke={BRAND.charcoal} strokeWidth="3" />
          {item.category === 'power' && <rect x={item.x - 10} y={item.y - 6} width="20" height="12" rx="3" fill="none" stroke={stroke} strokeWidth="2" />}
          {item.category === 'lighting' && <circle cx={item.x} cy={item.y} r="7" fill={item.variation ? '#ffffff' : BRAND.blue} stroke={item.variation ? '#ffffff' : BRAND.blue} strokeWidth="1.5" />}
          {item.category === 'switching' && <path d={`M ${item.x - 9} ${item.y + 6} L ${item.x + 8} ${item.y - 8}`} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />}
          {item.category === 'services' && <path d={`M ${item.x - 8} ${item.y + 5} Q ${item.x} ${item.y - 7} ${item.x + 8} ${item.y + 5}`} fill="none" stroke={stroke} strokeWidth="2.3" strokeLinecap="round" />}
          {item.category === 'compliance' && <path d={`M ${item.x} ${item.y - 9} L ${item.x + 9} ${item.y + 7} L ${item.x - 9} ${item.y + 7} Z`} fill="none" stroke={stroke} strokeWidth="2" />}
          <text x={item.x} y={item.y + 31} textAnchor="middle" fontSize="9" fontWeight="800" fill={BRAND.charcoal}>{item.short}</text>
          {selectedId === item.id && <circle cx={item.x} cy={item.y} r="27" fill="none" stroke={BRAND.blue} strokeWidth="3" strokeDasharray="6 4" />}
        </g>
      );
    }

    if (item.type === 'text') {
      return (
        <g key={item.id}>
          <text x={item.x} y={item.y} fontSize="20" fontWeight="700" fill={BRAND.charcoal}>{item.text}</text>
          {selectedId === item.id && <rect x={item.x - 6} y={item.y - 24} width="230" height="34" fill="none" stroke={BRAND.blue} strokeWidth="2" strokeDasharray="6 4" rx="8" />}
        </g>
      );
    }

    if (item.type === 'callout') {
      return (
        <g key={item.id}>
          <circle cx={item.x} cy={item.y} r="18" fill={BRAND.blue} stroke={BRAND.charcoal} strokeWidth="2.5" />
          <text x={item.x} y={item.y + 4} fontSize="12" fontWeight="800" textAnchor="middle" fill="#ffffff">{item.number}</text>
          <rect x={item.x + 24} y={item.y - 18} width="220" height="36" rx="10" fill="#ffffff" stroke={BRAND.blue} strokeWidth="2.5" />
          <text x={item.x + 36} y={item.y + 4} fontSize="12" fontWeight="700" fill={BRAND.charcoal}>{item.text}</text>
          {selectedId === item.id && <rect x={item.x - 10} y={item.y - 26} width="260" height="52" fill="none" stroke={BRAND.blue} strokeWidth="2" strokeDasharray="6 4" rx="10" />}
        </g>
      );
    }
    return null;
  };

  return (
    <div className="app-shell">
      <header className="topbar card">
        <div className="brand-wrap">
          <img src="/hillhomes-logo.png" alt="Hill Homes" className="logo" />
          <div>
            <h1>R J Hill Homes — iPad Electrical Review</h1>
            <p>Site-friendly markup, live variation tracking, and client-ready export.</p>
          </div>
        </div>
        <div className="toolbar-actions">
          <button className="btn btn-dark" onClick={() => fileInputRef.current?.click()}>Upload Plan</button>
          <button className="btn btn-light" onClick={saveReview}>Save</button>
          <button className="btn btn-light" onClick={exportPrintPack}>Print A3 Pack</button>
          <button className="btn btn-blue" onClick={exportVariations}>Export Variations</button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        </div>
      </header>

      <main className="main-grid">
        <section className="sidebar-left column-stack">
          <div className="card section">
            <h2>Project</h2>
            <label>Builder<input value={builderName} onChange={(e) => setBuilderName(e.target.value)} /></label>
            <label>Project<input value={projectName} onChange={(e) => setProjectName(e.target.value)} /></label>
            <div className="two-col">
              <label>Client<input value={clientName} onChange={(e) => setClientName(e.target.value)} /></label>
              <label>Revision<input value={planRevision} onChange={(e) => setPlanRevision(e.target.value)} /></label>
            </div>
          </div>

          <div className="card section">
            <h2>Tools</h2>
            <div className="tool-grid">
              {['select', 'symbol', 'text', 'callout'].map((item) => (
                <button key={item} className={`btn ${tool === item ? 'btn-dark' : 'btn-light'}`} onClick={() => setTool(item)}>{item[0].toUpperCase() + item.slice(1)}</button>
              ))}
            </div>
            <div className="zoom-row">
              <span>Zoom</span>
              <div className="zoom-controls">
                <button className="btn btn-light small" onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.1).toFixed(2))))}>-</button>
                <span className="pill">{Math.round(zoom * 100)}%</span>
                <button className="btn btn-light small" onClick={() => setZoom((z) => Math.min(2, Number((z + 0.1).toFixed(2))))}>+</button>
              </div>
            </div>
          </div>

          <div className="card section">
            <h2>Symbol Palette</h2>
            <div className="category-wrap">
              {CATEGORIES.map((cat) => (
                <button key={cat} className={`btn ${activeCategory === cat ? 'btn-blue' : 'btn-light'} small`} onClick={() => setActiveCategory(cat)}>{cat}</button>
              ))}
            </div>
            <div className="symbol-grid">
              {filteredSymbols.map((symbol) => (
                <button key={symbol.id} className={`symbol-card ${selectedSymbolId === symbol.id ? 'active' : ''}`} onClick={() => { setSelectedSymbolId(symbol.id); setTool('symbol'); }}>
                  <strong>{symbol.short}</strong>
                  <span>{symbol.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="workspace card">
          <div className="workspace-head">
            <div>
              <h2>Plan Workspace</h2>
              <p>Tap to place symbols, notes or variation callouts.</p>
            </div>
            <div className="pill">{markups.length} items · ${variationTotal} variations</div>
          </div>
          <div className="canvas-scroll">
            <div style={{ width: canvasSize.width * zoom, height: canvasSize.height * zoom }}>
              <svg ref={svgRef} viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`} style={{ width: canvasSize.width * zoom, height: canvasSize.height * zoom }} className="plan-canvas" onPointerDown={placeMarkup}>
                {imageSrc ? (
                  <image href={imageSrc} x="0" y="0" width={canvasSize.width} height={canvasSize.height} preserveAspectRatio="xMidYMid meet" />
                ) : (
                  <>
                    <rect x="0" y="0" width={canvasSize.width} height={canvasSize.height} fill="#f8fafc" />
                    <text x="50%" y="45%" textAnchor="middle" fontSize="34" fontWeight="800" fill="#334155">Upload a plan to begin</text>
                    <text x="50%" y="50%" textAnchor="middle" fontSize="18" fill="#64748b">Built for iPad site reviews, client meetings and electrician coordination</text>
                  </>
                )}
                {!imageSrc && <rect width="100%" height="100%" fill="url(#grid)" opacity="0.8" />}
                <defs>
                  <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                    <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#e2e8f0" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect x="18" y="18" width="390" height="88" rx="18" fill="#ffffff" stroke="#cbd5e1" />
                <text x="34" y="46" fontSize="18" fontWeight="800" fill={BRAND.charcoal}>{builderName}</text>
                <text x="34" y="70" fontSize="14" fontWeight="600" fill="#475569">{projectName}</text>
                <text x="34" y="91" fontSize="12" fill="#64748b">Client: {clientName} · {planRevision}</text>
                {markups.map(drawMarkup)}
              </svg>
            </div>
          </div>
        </section>

        <section className="sidebar-right column-stack">
          <div className="card section">
            <h2>Selected Item</h2>
            {selectedItem ? (
              <>
                <div className="item-head">
                  <span className={`pill ${selectedItem.variation ? 'pill-blue' : ''}`}>{selectedItem.label || selectedItem.type}</span>
                  <button className="btn btn-light small" onClick={deleteSelected}>Delete</button>
                </div>
                <label>Description<input value={selectedItem.description || selectedItem.text || ''} onChange={(e) => updateItem(selectedItem.id, 'description', e.target.value)} /></label>
                {(selectedItem.type === 'text' || selectedItem.type === 'callout') && <label>Displayed text<input value={selectedItem.text || ''} onChange={(e) => updateItem(selectedItem.id, 'text', e.target.value)} /></label>}
                <label className="checkbox-row"><input type="checkbox" checked={Boolean(selectedItem.variation)} onChange={(e) => updateItem(selectedItem.id, 'variation', e.target.checked)} />Mark as variation</label>
                <div className="two-col">
                  <label>Cost ($)<input value={selectedItem.cost || ''} onChange={(e) => updateItem(selectedItem.id, 'cost', e.target.value)} /></label>
                  <label>Trade<select value={selectedItem.trade || 'Electrical'} onChange={(e) => updateItem(selectedItem.id, 'trade', e.target.value)}><option>Electrical</option><option>Carpentry</option><option>Plumbing</option><option>Joinery</option></select></label>
                </div>
                <label>Status<select value={selectedItem.status || 'pending'} onChange={(e) => updateItem(selectedItem.id, 'status', e.target.value)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label>
              </>
            ) : <div className="empty-box">Use Select, then tap any item on the plan to edit details or mark it as a variation.</div>}
          </div>

          <div className="card section">
            <h2>Callouts, Notes & Layers</h2>
            <label>New text note<input value={textValue} onChange={(e) => setTextValue(e.target.value)} /></label>
            <label>New callout<input value={calloutText} onChange={(e) => setCalloutText(e.target.value)} /></label>
            <label>Site notes<textarea value={siteNotes} onChange={(e) => setSiteNotes(e.target.value)} rows={5} /></label>
            <div className="layer-list">
              {Object.keys(visibleLayers).map((layer) => (
                <label key={layer} className="checkbox-row"><input type="checkbox" checked={visibleLayers[layer]} onChange={(e) => setVisibleLayers((prev) => ({ ...prev, [layer]: e.target.checked }))} />{layer}</label>
              ))}
            </div>
          </div>

          <div className="card section">
            <h2>Variation List</h2>
            <div className="variation-list">
              {variations.length ? variations.map((item, index) => (
                <button key={item.id} className="variation-card" onClick={() => setSelectedId(item.id)}>
                  <div className="variation-row"><strong>{index + 1}. {item.label || item.type}</strong><span className={`status ${item.status || 'pending'}`}>{item.status || 'pending'}</span></div>
                  <div>{item.description || item.text || 'No description yet'}</div>
                  <div className="price">${item.cost || 0}</div>
                </button>
              )) : <div className="empty-box">No variations tagged yet.</div>}
            </div>
            <div className="total-card"><span>Variation Total</span><strong>${variationTotal}</strong></div>
          </div>

          <div className="card section">
            <h2>Pre-Wire Checklist</h2>
            {checklist.map((item, index) => (
              <label key={index} className="checkbox-row checklist-row"><input type="checkbox" checked={item.done} onChange={() => toggleChecklist(index)} /><span className={item.done ? 'done' : ''}>{item.text}</span></label>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
