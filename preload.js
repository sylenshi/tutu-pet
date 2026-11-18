const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  setSize: (w, h) => ipcRenderer.send('set-size', w, h),
  quitApp: () => ipcRenderer.send('quit-app'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  moveWindowBy: (dx, dy) => ipcRenderer.send('move-window-by', dx, dy),
  setClickThrough: (ignore) => ipcRenderer.send('set-click-through', ignore),
  onSizeChanged: (cb) => ipcRenderer.on('size-changed', (e, w, h) => cb(w, h)),
  onAutoBubbleChanged: (cb) => ipcRenderer.on('auto-bubble-changed', (e, enabled) => cb(enabled)),
  onCursorPosition: (cb) => ipcRenderer.on('cursor-position', (e, x, y) => cb(x, y)),
  onCursorOutside: (cb) => ipcRenderer.on('cursor-outside', () => cb())
});
