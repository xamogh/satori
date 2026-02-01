import process from 'node:process'

const stdout = process.stdout
if (typeof stdout.moveCursor !== 'function') {
  stdout.moveCursor = () => {}
}
if (typeof stdout.clearLine !== 'function') {
  stdout.clearLine = () => {}
}
if (typeof stdout.cursorTo !== 'function') {
  stdout.cursorTo = () => {}
}

const { build } = await import('electron-vite')
await build()
