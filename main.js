const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// --- GIỮ NGUYÊN HÀM GHI LOG VÀ CÁC IPC HANDLER CŨ ---

function logToFile(msg) {
  const logMsg = `[${new Date().toISOString()}] ${msg}\n`;
  const logPath = path.join(app.getPath('userData'), 'app-debug.log');
  console.log(logMsg.trim());
  try {
    fs.appendFileSync(logPath, logMsg);
  } catch (e) {
    console.error("Cannot write log:", e);
  }
}

// IPC handler để lưu file vào thư mục userData/documents
ipcMain.handle('save-pdf', async (event, { fileName, base64Data }) => {
  try {
    const docsDir = path.join(app.getPath('userData'), 'documents');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }
    // Tránh trùng tên tệp bằng cách thêm timestamp
    const safeFileName = `${Date.now()}_${fileName.replace(/[^a-z0-9.]/gi, '_')}`;
    const filePath = path.join(docsDir, safeFileName);
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);
    logToFile(`Saved PDF to: ${filePath}`);
    // Trả về file:// URL để PDF.js có thể đọc được
    return { success: true, filePath: `file://${filePath}`, localPath: filePath };
  } catch (err) {
    logToFile(`Error saving PDF: ${err.message}`);
    return { success: false, error: err.message };
  }
});

// IPC handler để lưu database JSON
ipcMain.handle('save-database', async (event, data) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'database.json');
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
    return { success: true };
  } catch (err) {
    logToFile(`Error saving database: ${err.message}`);
    return { success: false, error: err.message };
  }
});

// IPC handler để tải database JSON
ipcMain.handle('load-database', async () => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'database.json');
    if (fs.existsSync(dbPath)) {
      const content = fs.readFileSync(dbPath, 'utf8');
      return JSON.parse(content);
    }
    return null;
  } catch (err) {
    logToFile(`Error loading database: ${err.message}`);
    return null;
  }
});

// --- PHẦN SỬA ĐỔI CHÍNH: CẤU HÌNH CREATE WINDOW ---

function createWindow() {
  logToFile("Initializing Main Window...");
  
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false, // Ẩn cho đến khi load xong để tránh màn hình trắng
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false, // Quan trọng để load file:// và tài nguyên local
      devTools: true
    }
  });

  // Giữ nguyên cấu hình quyền truy cập Media
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'media') return true;
    return false;
  });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') return callback(true);
    callback(false);
  });

  // --- LOGIC LOAD URL ĐÃ ĐƯỢC SỬA LỖI ---
  if (app.isPackaged) {
    // 1. Chế độ Production (Đã đóng gói): Load file index.html từ thư mục dist
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    logToFile(`PRODUCTION MODE: Loading file from ${indexPath}`);
    
    mainWindow.loadFile(indexPath).catch(err => {
      logToFile(`CRITICAL ERROR: Could not load index.html at ${indexPath}. ${err.message}`);
    });
  } else {
    // 2. Chế độ Development: Load từ Vite Dev Server (http://localhost:3000)
    // Lưu ý: Đảm bảo bạn đã chạy 'npm run dev' ở một terminal khác
    const devUrl = 'http://localhost:3000'; 
    logToFile(`DEVELOPMENT MODE: Loading URL ${devUrl}`);
    
    mainWindow.loadURL(devUrl).catch(err => {
      logToFile(`Error loading Dev URL: ${err.message}. Fallback to file system.`);
      // Nếu không kết nối được server (quên chạy npm run dev), thử load file gốc
      mainWindow.loadFile(path.join(__dirname, 'index.html'));
    });

    // Tự động mở DevTools khi chạy code (F12) để dễ debug
    mainWindow.webContents.openDevTools();
  }

  // Hiển thị cửa sổ khi đã sẵn sàng
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    logToFile("Application Window is now visible.");
  });

  mainWindow.setMenuBarVisibility(false);
}

// --- APP LIFECYCLE (GIỮ NGUYÊN) ---

app.whenReady().then(() => {
  logToFile("System Kernel Ready.");
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  logToFile("Application shutting down.");
  if (process.platform !== 'darwin') app.quit();
});