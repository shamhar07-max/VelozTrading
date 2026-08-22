// Preload script — keep isolated, expose minimal safe API if needed
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('veloztrade', {
  version: '1.0.0',
  platform: 'windows',
});
