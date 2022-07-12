//main.js
const { app, BrowserWindow, ipcMain, nativeImage, NativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const https = require('https')

// function to see if app is called via cli
function checkIfCalledViaCLI(args){
	if(args && args.length > 1){
        if(args[1].includes('--debug-brk') || args[1].includes('--inspect-brk') || args[1].includes('--remote-debugging-port')){
			return false;
		}
		return true;
	}
	return false;
}

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  win.loadFile('index.html')
}

const iconName = path.join(__dirname, 'iconForDragAndDrop.png');
const icon = fs.createWriteStream(iconName);

// Create a new file to copy - you can also copy existing files.
fs.writeFileSync(path.join(__dirname, 'drag-and-drop-1.md'), '# First file to test drag and drop')
fs.writeFileSync(path.join(__dirname, 'drag-and-drop-2.md'), '# Second file to test drag and drop')

https.get('https://img.icons8.com/ios/452/drag-and-drop.png', (response) => {
  response.pipe(icon);
});

app.whenReady().then(() => {
  //createWindow()
  let isCalledViaCLI = checkIfCalledViaCLI(process.argv);
	
  if(isCalledViaCLI) {
      mainWindow = new BrowserWindow({ show: false, width: 0, height: 0});
  } else {
      mainWindow = new BrowserWindow({ show: true, width: 1050, height: 600});
  }
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

ipcMain.on('ondragstart', (event, filePath) => {
    event.sender.startDrag({
      file: path.join(__dirname, filePath),
      icon: iconName,
    })
  })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
