import koffi from 'koffi'
import { clipboard } from 'electron'

const user32 = koffi.load('user32.dll')
const keybd_event = user32.func('void keybd_event(uint8 bVk, uint8 bScan, uint32 dwFlags, uint64 dwExtraInfo)')
const GetAsyncKeyState = user32.func('short GetAsyncKeyState(int vKey)')

const VK_CONTROL = 0x11
const VK_V = 0x56
const VK_C = 0x43
const KEYEVENTF_KEYUP = 0x0002

async function waitForModifierRelease(): Promise<void> {
  const modifiers = [VK_CONTROL]
  while (modifiers.some((vk) => (GetAsyncKeyState(vk) & 0x8000) !== 0)) {
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

async function sendKeyCombo(vk: number): Promise<void> {
  await waitForModifierRelease()

  keybd_event(VK_CONTROL, 0, 0, 0)
  keybd_event(vk, 0, 0, 0)
  keybd_event(vk, 0, KEYEVENTF_KEYUP, 0)
  keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0)

  await new Promise((resolve) => setTimeout(resolve, 150))
}

export async function pasteText(text: string): Promise<void> {
  const originalClipboard = clipboard.readText()

  try {
    clipboard.writeText(text)
    await sendKeyCombo(VK_V)
  } finally {
    setTimeout(() => {
      clipboard.writeText(originalClipboard)
    }, 300)
  }
}

export async function simulateCopy(): Promise<string> {
  const originalClipboard = clipboard.readText()

  try {
    clipboard.clear()
    await sendKeyCombo(VK_C)
    return clipboard.readText()
  } finally {
    setTimeout(() => {
      clipboard.writeText(originalClipboard)
    }, 300)
  }
}
