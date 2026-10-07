'use strict';

/* Win32 por koffi: recordar la ventana que estaba adelante antes de abrir el
   panel, y después tipear el carácter ahí como unidades UTF-16 con SendInput.
   Sin leer ni escribir el portapapeles, sin hooks, sin sondeos ni registro de
   teclas en segundo plano. */

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
const sendMessage = user.func('intptr_t __stdcall SendMessageW(uintptr_t hwnd, uint32_t msg, uintptr_t wParam, intptr_t lParam)');
const thisThread = koffi.load('kernel32.dll').func('uint32_t __stdcall GetCurrentThreadId()');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const same = (a, b) => BigInt(a) === BigInt(b);

/* Un INPUT de teclado mide 40 bytes en x64 (28 en x86), con la unión que
   arranca en 8 (4). Adentro, KEYBDINPUT: wVk (2), wScan (2), dwFlags (4)… */
const stride = process.arch === 'ia32' ? 28 : 40;
const offset = process.arch === 'ia32' ? 4 : 8;
const INPUT_KEYBOARD = 1;
const KEYEVENTF_KEYUP = 2;
const KEYEVENTF_UNICODE = 4;

/* Cada unidad UTF-16 va como apretar y soltar. Un emoji compuesto (pares
   sustitutos, ZWJ, tonos) es solo una secuencia más larga. */
function events(text) {
  const buffer = Buffer.alloc(text.length * 2 * stride);
  for (let i = 0; i < text.length; i++) {
    for (let up = 0; up < 2; up++) {
      const at = (i * 2 + up) * stride;
      buffer.writeUInt32LE(INPUT_KEYBOARD, at);
      buffer.writeUInt16LE(text.charCodeAt(i), at + offset + 2);
      buffer.writeUInt32LE(KEYEVENTF_UNICODE | (up ? KEYEVENTF_KEYUP : 0), at + offset + 4);
    }
  }
  return buffer;
}

// Shift, Ctrl, Alt, las dos Win y Enter.
const HELD = [0x10, 0x11, 0x12, 0x5b, 0x5c, 0x0d];

async function insert(hwnd, text) {
  if (!hwnd || !valid(hwnd)) throw new Error('Volvé al campo de texto y abrí Moji con el atajo.');

  // Esperar a que se suelten las teclas del atajo (o el Enter que eligió).
  for (let i = 0; i < 80; i++) {
    if (!HELD.some((key) => keyState(key) & 0x8000)) break;
    await sleep(20);
    if (i === 79) throw new Error('Soltá las teclas del atajo e intentá de nuevo.');
  }

  focus(hwnd);
  for (let i = 0; i < 12 && !same(foreground(), hwnd); i++) await sleep(20);
  if (!same(foreground(), hwnd)) throw new Error('No pude volver a la ventana. Usá Copiar o abrí Moji desde el campo de texto.');
  await sleep(35);
  if (!same(foreground(), hwnd)) throw new Error('La ventana cambió antes de insertar. Intentá de nuevo.');

  const input = events(text);
  if (send(text.length * 2, input, stride) !== text.length * 2) {
    throw new Error('Windows bloqueó la inserción en esa app. Podés copiar el carácter desde Moji.');
  }
  // Moji retoma el foco después: margen para que Windows entregue las teclas a la app.
  await sleep(50);
}

/* Moji acaba de darle el primer plano a otra app, así que el bloqueo de
   primer plano de Windows puede rechazar un SetForegroundWindow a secas.
   Compartir el estado de entrada con el hilo de la ventana de adelante
   durante la llamada deja que Moji lo recupere. */
function reclaim(hwnd) {
  const fg = foreground();
  if (same(fg, hwnd)) return true;
  const from = thisThread();
  const to = fg ? threadOf(fg, null) : 0;
  const joined = to && to !== from && attach(from, to, true);
  try {
    toTop(hwnd);
    focus(hwnd);
  } finally {
    if (joined) attach(from, to, false);
  }
  return same(foreground(), hwnd);
}

/* El acrílico de Windows 11 se apaga (pasa a un gris sólido) cuando la
   ventana recibe WM_NCACTIVATE(FALSE), o sea, al perder el foco. Mandarle
   WM_NCACTIVATE(TRUE) le devuelve el vidrio sin tocar el foco de verdad: las
   teclas siguen yendo a la app de adelante. Medido en un laboratorio: con
   FALSE se pone sólida, con TRUE vuelve el escritorio desenfocado. */
const WM_NCACTIVATE = 0x86;
function lookActive(hwnd) {
  sendMessage(hwnd, WM_NCACTIVATE, 1, 0);
}

module.exports = { foreground, focus, insert, reclaim, events, stride, lookActive, WM_NCACTIVATE };
