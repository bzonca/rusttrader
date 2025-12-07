const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // FCM Credential Management
  checkCredentials: () => ipcRenderer.invoke('check-credentials'),
  getCredentials: () => ipcRenderer.invoke('get-credentials'),
  deleteCredentials: () => ipcRenderer.invoke('delete-credentials'),
  generateCredentials: () => ipcRenderer.invoke('generate-credentials'),
  
  // Pairing listener
  startPairingListener: (credentials) => ipcRenderer.invoke('start-pairing-listener', credentials),
  stopPairingListener: () => ipcRenderer.invoke('stop-pairing-listener'),
  
  // Server management
  getServers: () => ipcRenderer.invoke('get-servers'),
  saveServer: (serverData) => ipcRenderer.invoke('save-server', serverData),
  deleteServer: (serverId) => ipcRenderer.invoke('delete-server', serverId),
  
  // Vending machine data
  getVendingData: (server) => ipcRenderer.invoke('get-vending-data', server),
  
  // Item data
  getItemNames: () => ipcRenderer.invoke('get-item-names'),
  refreshItemData: () => ipcRenderer.invoke('refresh-item-data'),
  
  // Event listeners
  onPairingUpdate: (callback) => {
    ipcRenderer.on('pairing-update', (event, data) => callback(data));
  },
  removePairingListeners: () => {
    ipcRenderer.removeAllListeners('pairing-update');
  }
});
