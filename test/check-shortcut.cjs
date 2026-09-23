'use strict';
const { app, globalShortcut } = require('electron');
const shortcut = process.argv[2];

app.whenReady().then(() => {
  let available = false;
  try { available = globalShortcut.register(shortcut, () => {}); } catch {}
  console.log(available ? `LIBRE ${shortcut}` : `OCUPADO ${shortcut}`);
  globalShortcut.unregisterAll();
  app.exit(available ? 0 : 1);
});
