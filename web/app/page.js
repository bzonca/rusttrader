'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ==================== HELPERS ====================

function getItemName(itemId, itemNames) {
  const id = String(itemId);
  if (itemNames[id]) {
    return itemNames[id].name || itemNames[id];
  }
  return `Unknown Item (${id})`;
}

function getGridPosition(worldX, worldY, mapSize) {
  const gridSize = 150;
  const grids = Math.ceil(mapSize / gridSize);
  const adjustedX = worldX + (mapSize / 2);
  const adjustedY = worldY + (mapSize / 2);
  const gridX = Math.floor(adjustedX / gridSize);
  const gridZ = Math.floor((mapSize - adjustedY) / gridSize);
  const clampedX = Math.max(0, Math.min(grids - 1, gridX));
  const clampedZ = Math.max(0, Math.min(grids - 1, gridZ));

  function numberToLetter(num) {
    let result = '';
    let n = num;
    while (n >= 0) {
      result = String.fromCharCode(65 + (n % 26)) + result;
      n = Math.floor(n / 26) - 1;
      if (n < 0) break;
    }
    return result || 'A';
  }

  return `${numberToLetter(clampedX)}${clampedZ}`;
}

// ==================== MAIN COMPONENT ====================

export default function RustTrader() {
  const [servers, setServers] = useState([]);
  const [currentServer, setCurrentServer] = useState(null);
  const [vendingData, setVendingData] = useState(null);
  const [itemNames, setItemNames] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [theme, setTheme] = useState('rust');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Filter state
  const [searchItem, setSearchItem] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [shopNameFilter, setShopNameFilter] = useState('');
  const [hideOutOfStock, setHideOutOfStock] = useState(false);
  const [sortBy, setSortBy] = useState('name');

  // Load theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('selectedTheme') || 'rust';
    setTheme(savedTheme);
  }, []);

  useEffect(() => {
    const themeFiles = {
      'rust': '/styles-rust.css',
      'retro': '/styles-retro.css',
      'modern': '/styles-modern.css'
    };

    let link = document.getElementById('theme-stylesheet');
    if (!link) {
      link = document.createElement('link');
      link.id = 'theme-stylesheet';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = themeFiles[theme] || themeFiles['rust'];
    localStorage.setItem('selectedTheme', theme);
  }, [theme]);

  // Load servers from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('rusttrader_servers');
    if (saved) {
      try { setServers(JSON.parse(saved)); } catch {}
    }
  }, []);

  // Load item names
  useEffect(() => {
    fetch('/api/item-names')
      .then(r => r.json())
      .then(data => setItemNames(data))
      .catch(err => console.error('Failed to load item names:', err));
  }, []);

  // Save servers to localStorage
  const saveServers = useCallback((newServers) => {
    setServers(newServers);
    localStorage.setItem('rusttrader_servers', JSON.stringify(newServers));
  }, []);

  // Add server
  const addServer = useCallback((serverData) => {
    const existing = servers.findIndex(s => s.serverIp === serverData.serverIp && s.appPort === serverData.appPort);
    let newServers;
    if (existing >= 0) {
      newServers = [...servers];
      newServers[existing] = { ...serverData, id: servers[existing].id };
    } else {
      serverData.id = Date.now().toString();
      newServers = [...servers, serverData];
    }
    saveServers(newServers);
    setShowAddModal(false);
    setCurrentServer(serverData);
  }, [servers, saveServers]);

  // Delete server
  const deleteServer = useCallback((serverId) => {
    if (!confirm('Are you sure you want to delete this server?')) return;
    const newServers = servers.filter(s => s.id !== serverId);
    saveServers(newServers);
    if (currentServer?.id === serverId) {
      setCurrentServer(null);
      setVendingData(null);
    }
  }, [servers, currentServer, saveServers]);

  // Select server and load data
  const selectServer = useCallback(async (server) => {
    setCurrentServer(server);
    setMobileMenuOpen(false);
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/vending-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(server)
      });
      const data = await res.json();

      if (data.success) {
        setVendingData(data);
        setError(null);
      } else {
        setError(data.error || 'Failed to connect to server');
        setVendingData(null);
      }
    } catch (err) {
      setError(err.message);
      setVendingData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh data
  const refreshVendingData = useCallback(() => {
    if (currentServer) selectServer(currentServer);
  }, [currentServer, selectServer]);

  // Process items for display
  const allItems = [];
  let totalShops = 0;

  if (vendingData?.vendingMachines) {
    const ms = vendingData.mapSize || 4000;
    const pp = vendingData.playerPosition;

    vendingData.vendingMachines.forEach(machine => {
      if (machine.sellOrders?.length > 0) {
        totalShops++;
        machine.sellOrders.forEach(order => {
          let distance = null;
          if (pp) {
            const dx = machine.x - pp.x;
            const dy = machine.y - pp.y;
            distance = Math.sqrt(dx * dx + dy * dy);
          }

          allItems.push({
            ...order,
            machineName: machine.name,
            machineId: machine.id,
            x: machine.x,
            y: machine.y,
            distance
          });
        });
      }
    });
  }

  // Filter items
  const filteredItems = allItems.filter(item => {
    const name = getItemName(item.itemId, itemNames).toLowerCase();
    const currency = getItemName(item.currencyId, itemNames).toLowerCase();
    const shopName = (item.machineName || '').toLowerCase();
    const stock = item.amountInStock ?? 0;

    if (searchItem && !name.includes(searchItem.toLowerCase())) return false;
    if (currencyFilter && !currency.includes(currencyFilter.toLowerCase())) return false;
    if (shopNameFilter && !shopName.includes(shopNameFilter.toLowerCase())) return false;
    if (hideOutOfStock && stock === 0) return false;
    return true;
  });

  // Sort items
  filteredItems.sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return getItemName(a.itemId, itemNames).localeCompare(getItemName(b.itemId, itemNames));
      case 'price':
        return (a.costPerItem || 0) - (b.costPerItem || 0);
      case 'price_desc':
        return (b.costPerItem || 0) - (a.costPerItem || 0);
      case 'stock': {
        const sa = a.amountInStock ?? 0;
        const sb = b.amountInStock ?? 0;
        if (sa === 0 && sb === 0) return 0;
        if (sa === 0) return 1;
        if (sb === 0) return -1;
        return sb - sa;
      }
      case 'distance':
        return (a.distance ?? Infinity) - (b.distance ?? Infinity);
      default:
        return 0;
    }
  });

  const mapSize = vendingData?.mapSize || 4000;

  return (
    <>
      {/* Add Server Modal */}
      {showAddModal && (
        <AddServerModal
          onClose={() => setShowAddModal(false)}
          onAdd={addServer}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          onClose={() => setShowSettingsModal(false)}
          servers={servers}
        />
      )}

      {servers.length === 0 && !showAddModal ? (
        /* Empty / Welcome State */
        <div className="fullscreen-state" style={{ display: 'flex' }}>
          <div className="login-container" style={{ textAlign: 'center', maxWidth: 500 }}>
            <h1 style={{ fontSize: '3rem', marginBottom: 20 }}>Rust Trader</h1>
            <p style={{ color: '#9e9e9e', marginBottom: 40, fontSize: '1.2rem' }}>
              Track vending machines and find the best deals on your Rust server.
            </p>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              Add Your First Server
            </button>
          </div>
        </div>
      ) : (
        /* Main App Layout */
        <div className="app-layout" style={{ display: 'flex' }}>
          {/* Mobile Menu Toggle */}
          <button className="mobile-menu-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Sidebar */}
          <div className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
            <div className="sidebar-header">
              <div className="logo-section">
                <h2 className="sidebar-title">Rust Trader</h2>
                <p className="sidebar-subtitle">Live Market Tracker</p>
              </div>
            </div>

            <div className="sidebar-section-title">YOUR SERVERS</div>

            <div className="sidebar-content">
              <div className="server-list">
                {servers.map(server => (
                  <div
                    key={server.id}
                    className={`server-item ${currentServer?.id === server.id ? 'active' : ''}`}
                    onClick={() => selectServer(server)}
                  >
                    <div className="server-item-info">
                      <div className="server-item-name">{server.serverName}</div>
                      <div className="server-item-ip">{server.serverIp}:{server.appPort}</div>
                    </div>
                    <button
                      className="server-delete-btn"
                      onClick={(e) => { e.stopPropagation(); deleteServer(server.id); }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"
                              stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              <button className="add-server-btn" onClick={() => setShowAddModal(true)}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>Add Server</span>
              </button>
            </div>

            <div className="sidebar-footer">
              <div className="user-info">
                <div className="user-details">
                  <div className="username">Rust Trader Web</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                      className="btn btn-sm"
                      style={{ flex: 1, cursor: 'pointer' }}
                    >
                      <option value="rust">Rust Theme</option>
                      <option value="retro">Retro CRT</option>
                      <option value="modern">Modern</option>
                    </select>
                    <button className="btn btn-sm" onClick={() => setShowSettingsModal(true)}>Settings</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="main-content">
            {!currentServer ? (
              <div className="empty-state">
                <div className="empty-state-content">
                  <div className="empty-state-icon">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                      <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <h1>Select a Server</h1>
                  <p className="empty-state-description">
                    Choose a server from the sidebar or add a new one to start tracking vending machines.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                {/* Header */}
                <div className="header-with-filters">
                  <div className="server-header">
                    <div className="server-info">
                      <h1>{currentServer.serverName}</h1>
                      <div className="server-stats">
                        <span className="stat-item">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2"/>
                            <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2"/>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2"/>
                          </svg>
                          <span>{vendingData?.serverInfo ? `${vendingData.serverInfo.players}/${vendingData.serverInfo.maxPlayers}` : '...'}</span>
                        </span>
                        <span className="stat-item">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
                            <path d="M3 9h18" stroke="currentColor" strokeWidth="2"/>
                          </svg>
                          <span>{vendingData?.serverInfo?.size || '...'}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="filters">
                    <h2 className="section-title">Search & Filter</h2>
                    <div className="filter-grid">
                      <div className="input-group">
                        <label>Search Item</label>
                        <input type="text" placeholder="e.g. Metal, Wood, Scrap" value={searchItem} onChange={e => setSearchItem(e.target.value)} />
                      </div>
                      <div className="input-group">
                        <label>Currency Filter</label>
                        <input type="text" placeholder="e.g. Scrap, HQM" value={currencyFilter} onChange={e => setCurrencyFilter(e.target.value)} />
                      </div>
                      <div className="input-group">
                        <label>Shop Name</label>
                        <input type="text" placeholder="e.g. Mini Mart" value={shopNameFilter} onChange={e => setShopNameFilter(e.target.value)} />
                      </div>
                    </div>
                    <div className="filter-actions">
                      <div className="input-group">
                        <label>Sort By</label>
                        <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
                          <option value="name">Item Name (A-Z)</option>
                          <option value="price">Price (Low to High)</option>
                          <option value="price_desc">Price (High to Low)</option>
                          <option value="stock">Stock (Most Available)</option>
                          <option value="distance">Distance (Nearest First)</option>
                        </select>
                      </div>
                      <div className="checkbox-group">
                        <input type="checkbox" id="hideOutOfStock" checked={hideOutOfStock} onChange={e => setHideOutOfStock(e.target.checked)} />
                        <label htmlFor="hideOutOfStock">Hide Out of Stock</label>
                      </div>
                      <button onClick={refreshVendingData} className="btn--secondary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Refresh
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="stats">
                    <div className="stat-card">
                      <div className="stat-value">{totalShops}</div>
                      <div className="stat-label">Total Shops</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{allItems.length}</div>
                      <div className="stat-label">Items Listed</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{filteredItems.length}</div>
                      <div className="stat-label">Matching Items</div>
                    </div>
                  </div>
                </div>

                {/* Loading */}
                {loading && (
                  <div className="loading-state" style={{ display: 'flex' }}>
                    <div className="spinner"></div>
                    <p>Connecting to server and loading vending machines...</p>
                  </div>
                )}

                {/* Error */}
                {error && !loading && (
                  <div style={{ padding: 20, color: 'var(--danger)', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                    Failed to connect to server: {error}
                  </div>
                )}

                {/* Items Table */}
                {!loading && !error && vendingData && (
                  filteredItems.length > 0 ? (
                    <div className="shops-container" style={{ display: 'block' }}>
                      <div id="shopsList">
                        <div className="list-header">
                          <div>Item</div>
                          <div>Cost</div>
                          <div>Stock</div>
                          <div>Shop</div>
                          <div>Location</div>
                          <div>Distance</div>
                        </div>
                        {filteredItems.map((item, idx) => {
                          const stock = item.amountInStock ?? 0;
                          const itemName = getItemName(item.itemId, itemNames);
                          const currencyName = getItemName(item.currencyId, itemNames);
                          const gridPos = getGridPosition(item.x, item.y, mapSize);
                          const distanceText = item.distance != null ? `${Math.round(item.distance)}m` : '-';

                          return (
                            <div key={`${item.machineId}-${item.itemId}-${item.currencyId}-${idx}`} className={`shop-row ${stock === 0 ? 'out-of-stock' : ''}`}>
                              <div className="sale"><span>{item.quantity > 1 ? `${item.quantity}x ` : ''}{itemName}</span></div>
                              <div className="cost"><span>{item.costPerItem} {currencyName}</span></div>
                              <div className="stock">{stock}</div>
                              <div className="shop-name">{item.machineName}</div>
                              <div className="location">{gridPos}</div>
                              <div className="distance">{distanceText}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state" style={{ minHeight: 200 }}>
                      <p>{allItems.length === 0 ? 'No vending machines found on this server' : 'No items match your filters'}</p>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ==================== ADD SERVER MODAL ====================

function AddServerModal({ onClose, onAdd }) {
  const [formData, setFormData] = useState({
    serverName: '',
    serverIp: '',
    appPort: '',
    playerId: '',
    playerToken: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.serverName || !formData.serverIp || !formData.appPort || !formData.playerId || !formData.playerToken) {
      alert('Please fill in all fields');
      return;
    }
    onAdd({
      ...formData,
      appPort: parseInt(formData.appPort)
    });
  };

  return (
    <div className="modal active">
      <div className="modal-content">
        <div className="modal-header">
          <span className="modal-close" onClick={onClose}>&times;</span>
          <h2>Add Server</h2>
        </div>
        <div className="pairing-status">
          <p style={{ marginBottom: 15, fontSize: '0.85rem' }}>
            Enter your Rust+ connection details. You can find these by pairing your server
            in the Rust+ companion app, or from tools like RustPlus.js.
          </p>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="input-group">
                <label>Server Name</label>
                <input type="text" placeholder="My Rust Server" value={formData.serverName}
                  onChange={e => setFormData({...formData, serverName: e.target.value})} />
              </div>
              <div className="input-group">
                <label>Server IP</label>
                <input type="text" placeholder="123.45.67.89" value={formData.serverIp}
                  onChange={e => setFormData({...formData, serverIp: e.target.value})} />
              </div>
              <div className="input-group">
                <label>App Port (Rust+ Port)</label>
                <input type="text" placeholder="28083" value={formData.appPort}
                  onChange={e => setFormData({...formData, appPort: e.target.value})} />
              </div>
              <div className="input-group">
                <label>Player ID (Steam ID)</label>
                <input type="text" placeholder="76561198..." value={formData.playerId}
                  onChange={e => setFormData({...formData, playerId: e.target.value})} />
              </div>
              <div className="input-group">
                <label>Player Token</label>
                <input type="text" placeholder="Your player token" value={formData.playerToken}
                  onChange={e => setFormData({...formData, playerToken: e.target.value})} />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Add Server</button>
                <button type="button" className="btn" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ==================== SETTINGS MODAL ====================

function SettingsModal({ onClose, servers }) {
  const handleExport = () => {
    const data = JSON.stringify(servers, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rusttrader-servers.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearData = () => {
    if (!confirm('Are you sure you want to clear all saved data? This will remove all servers.')) return;
    localStorage.removeItem('rusttrader_servers');
    window.location.reload();
  };

  return (
    <div className="modal active">
      <div className="modal-content">
        <div className="modal-header">
          <span className="modal-close" onClick={onClose}>&times;</span>
          <h2>Settings</h2>
        </div>
        <div className="pairing-status">
          <p style={{ marginBottom: 10 }}>Server data is stored locally in your browser.</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 15 }}>
            {servers.length} server{servers.length !== 1 ? 's' : ''} saved
          </p>
          <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
            <button className="btn" onClick={handleExport}>Export Servers</button>
            <button className="btn btn-danger" onClick={handleClearData}>Clear All Data</button>
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
