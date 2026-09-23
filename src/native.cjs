'use strict';
// Win32: remember the foreground window before opening, then send UTF-16.
// No clipboard reads, writes, hooks, polling service, or background key logging.
const koffi = require('koffi');
const user = koffi.load('user32.dll');
const foreground = user.func('uintptr_t __stdcall GetForegroundWindow()');
const focus = user.func('bool __stdcall SetForegroundWindow(uintptr_t hwnd)');
const valid = user.func('bool __stdcall IsWindow(uintptr_t hwnd)');
const keyState = user.func('int16_t __stdcall GetAsyncKeyState(int key)');
const send = user.func('uint32_t __stdcall SendInput(uint32_t count, const void *inputs, int size)');
const threadOf = user.func('uint32_t __stdcall GetWindowThreadProcessId(uintptr_t hwnd, void *pid)');
const attach = user.func('bool __stdcall AttachThreadInput(uint32_t from, uint32_t to, bool on)');
const toTop = user.func('bool __stdcall BringWindowToTop(uintptr_t hwnd)');
const thisThread = koffi.load('kernel32.dll').func('uint32_t __stdcall GetCurrentThreadId()');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const stride = process.arch === 'ia32' ? 28 : 40;
const offset = process.arch === 'ia32' ? 4 : 8;
function events(text) {
  const buffer = Buffer.alloc(text.length * 2 * stride);
  for (let i = 0; i < text.length; i++) {
    for (let up = 0; up < 2; up++) {
      const at = (i * 2 + up) * stride;
      buffer.writeUInt32LE(1, at); // INPUT_KEYBOARD
      buffer.writeUInt16LE(text.charCodeAt(i), at + offset + 2);
      buffer.writeUInt32LE(4 | (up ? 2 : 0), at + offset + 4); // UNICODE / KEYUP
    }
  }
  return buffer;
}
async function insert(hwnd, text) {
  if (!hwnd || !valid(hwnd)) throw new Error('Volvé al campo de texto y abrí Moji con el atajo.');
  // Wait for the opening chord or keyboard selection to be released.
  for (let i = 0; i < 80; i++) {
    if (![0x10, 0x11, 0x12, 0x5b, 0x5c, 0x0d].some(key => keyState(key) & 0x8000)) break;
    await sleep(20);
    if (i === 79) throw new Error('Soltá las teclas del atajo e intentá de nuevo.');
  }
  focus(hwnd);
  for (let i = 0; i < 12 && BigInt(foreground()) !== BigInt(hwnd); i++) await sleep(20);
  if (BigInt(foreground()) !== BigInt(hwnd)) throw new Error('No pude volver a la ventana. Usá Copiar o abrí Moji desde el campo de texto.');
  await sleep(35);
  if (BigInt(foreground()) !== BigInt(hwnd)) throw new Error('La ventana cambió antes de insertar. Intentá de nuevo.');
  const input = events(text);
  if (send(text.length * 2, input, stride) !== text.length * 2) {
    throw new Error('Windows bloqueó la inserción en esa app. Podés copiar el carácter desde Moji.');
  }
  // Moji retoma el foco después: margen para que Windows entregue las teclas a la app.
  await sleep(50);
}
// Moji just handed the foreground to another app, so Windows' foreground lock can
// refuse a plain SetForegroundWindow. Sharing input state with the current
// foreground thread for the call lets Moji take it back.
function reclaim(hwnd) {
  const fg = foreground();
  if (BigInt(fg) === BigInt(hwnd)) return true;
  const from = thisThread(), to = fg ? threadOf(fg, null) : 0;
  const joined = to && to !== from && attach(from, to, true);
  try { toTop(hwnd); focus(hwnd); } finally { if (joined) attach(from, to, false); }
  return BigInt(foreground()) === BigInt(hwnd);
}
module.exports = { foreground, focus, insert, reclaim, events, stride };
