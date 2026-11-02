const { app, BrowserWindow, ipcMain } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const USER_DATA_FILE = 'orbit-user-data.json'
const BACKUP_FOLDER = 'backups'

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function getUserDataPaths() {
  const userDataDir = app.getPath('userData')
  return {
    userDataDir,
    dataFilePath: path.join(userDataDir, USER_DATA_FILE),
    backupDirPath: path.join(userDataDir, BACKUP_FOLDER),
  }
}

function writeAtomically(filePath, content) {
  const tempPath = `${filePath}.tmp`
  fs.writeFileSync(tempPath, content, 'utf8')
  fs.renameSync(tempPath, filePath)
}

function keepRecentBackups(backupsDir) {
  if (!fs.existsSync(backupsDir)) {
    return
  }

  const files = fs
    .readdirSync(backupsDir)
    .filter((file) => /^orbit-user-data-.*\.json$/.test(file))
    .sort()
    .reverse()

  files.slice(7).forEach((file) => {
    fs.unlinkSync(path.join(backupsDir, file))
  })
}

function createBackupSnapshot(filePath, backupDirPath) {
  if (!fs.existsSync(filePath)) {
    return
  }

  ensureDirectory(backupDirPath)

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(backupDirPath, `orbit-user-data-${timestamp}.json`)
  fs.copyFileSync(filePath, backupPath)
  keepRecentBackups(backupDirPath)
}

ipcMain.handle('app:read-data', () => {
  const { dataFilePath } = getUserDataPaths()
  if (!fs.existsSync(dataFilePath)) {
    return null
  }

  return fs.readFileSync(dataFilePath, 'utf8')
})

ipcMain.handle('app:write-data', (_, payload) => {
  const { userDataDir, dataFilePath, backupDirPath } = getUserDataPaths()
  ensureDirectory(userDataDir)
  writeAtomically(dataFilePath, payload)
  createBackupSnapshot(dataFilePath, backupDirPath)
})

ipcMain.handle('app:get-user-data-path', () => app.getPath('userData'))

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 700,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL
  if (devServerUrl) {
    win.loadURL(devServerUrl)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
