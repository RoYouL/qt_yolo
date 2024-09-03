const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs-extra');
const ffmpeg = require('fluent-ffmpeg');

const basePath = app.isPackaged ? path.join(process.resourcesPath) : __dirname;

const scriptPath = path.resolve(basePath, 'yolov5-master', 'detect.py');
const ffmpegPath = path.join(basePath, 'ffmpeg-7.0.2-essentials_build', 'bin', 'ffmpeg.exe');
const detectDir = path.join(basePath, 'yolov5-master', 'runs', 'detect');
const pythonPathFile = path.join(basePath, 'python-path.txt');  // 存储 Python 路径的文件


function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(basePath, 'preload.js')
        },
        // 这将隐藏默认的菜单栏
        autoHideMenuBar: true
    });

    win.loadFile('index.html');

    // 打开开发者工具，并将其与新的窗口关联
    // const devToolsWindow = new BrowserWindow({ width: 800, height: 600 });
    // win.webContents.setDevToolsWebContents(devToolsWindow.webContents);
    // win.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(() => {
    createWindow();

    ipcMain.on('process-video', async (event, videoPath) => {
        const outputPath = path.join(detectDir, 'processed_video.mp4');

        // FFmpeg 转码命令
        const ffmpegCommand = `"${ffmpegPath}" -i "${videoPath}" -c:v libx264 -preset slow -crf 22 -c:a aac -b:a 192k "${outputPath}"`;

        exec(ffmpegCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error: ${error.message}`);
                event.sender.send('video-processing-error', error.message);
                return;
            }

            if (stderr) {
                console.error(`Stderr: ${stderr}`);
            }

            console.log(`Stdout: ${stdout}`);
            event.sender.send('video-processed', outputPath);
        });
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});


ipcMain.handle('get-python-path', () => {
    return new Promise((resolve, reject) => {
        fs.readFile(pythonPathFile, 'utf8', (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data.trim());  // 去除首尾空白字符
            }
        });
    });
});
let pythonPath = 'D:\\environment\\work_tool\\anaconda3\\envs\\py311\\python.exe';  // 默认 Python 路径
// 从文件加载 Python 路径
if (fs.existsSync(pythonPathFile)) {
    pythonPath = fs.readFileSync(pythonPathFile, 'utf-8').trim();
}
ipcMain.on('select-python-path', async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Executables', extensions: ['exe'] }]
    });

    if (canceled || !filePaths || filePaths.length === 0) {
        console.log("Python path selection canceled or invalid file path.");
        return;
    }

    const selectedPath = filePaths[0];
    try {
        // 清空文件内容并写入新的 Python 路径
        fs.writeFileSync(pythonPathFile, selectedPath, 'utf-8');
        console.log(`Python path saved to ${pythonPathFile}`);
        event.sender.send('python-path-selected', selectedPath);  // 通知渲染进程更新路径
    } catch (error) {
        console.error('Failed to save Python path:', error);
    }
});



let cameraDetectionProcess = null;

// 处理摄像头检测请求
ipcMain.on('start-camera-detection', (event, cameraIndex) => {
    console.log(`Starting camera detection on camera ${cameraIndex}...`);

    cameraDetectionProcess = spawn(pythonPath, [scriptPath, '--source', cameraIndex.toString()], {
        cwd: path.join(basePath, 'yolov5-master')
    });

    cameraDetectionProcess.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
    });

    cameraDetectionProcess.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
        // 将错误信息发送到渲染进程
        event.sender.send('camera-detection-error', data.toString());
    });

    cameraDetectionProcess.on('error', (err) => {
        console.error(`Failed to start subprocess: ${err.message}`);
        event.sender.send('camera-detection-error', `Failed to start subprocess: ${err.message}`);
    });

    cameraDetectionProcess.on('close', (code) => {
        console.log(`Child process exited with code ${code}`);
        cameraDetectionProcess = null;  // 清除引用
    });
});

// 中断摄像头检测
ipcMain.on('stop-camera-detection', () => {
    if (cameraDetectionProcess) {
        cameraDetectionProcess.kill('SIGINT');  // 发送 SIGINT 信号以中断进程
        console.log('Camera detection process terminated.');
    }
});


// 获取最新生成的 exp 目录
function getLatestExpDir() {
    const runsDir = path.join(basePath, 'yolov5-master', 'runs', 'detect');
    const dirs = fs.readdirSync(runsDir).filter(file => fs.statSync(path.join(runsDir, file)).isDirectory());
    dirs.sort((a, b) => {
        return fs.statSync(path.join(runsDir, b)).mtime - fs.statSync(path.join(runsDir, a)).mtime;
    });
    return path.join(runsDir, dirs[0]);
}

ipcMain.on('upload-image', async (event) => {
    console.log(`Python Path: ${pythonPath}`);
    console.log(`Script Path: ${scriptPath}`);
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png'] }]
    });
    if (canceled || !filePaths || filePaths.length === 0) {
        console.log("Image selection canceled or invalid file path.");
        return;
    }

    console.log(`Selected image: ${filePaths[0]}`);

    const process = spawn(pythonPath, [scriptPath, '--source', filePaths[0]], {
        cwd: path.join(basePath, 'yolov5-master')
    });

    process.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
        event.sender.send('processing-progress');
    });

    process.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
        event.sender.send('processing-progress');
    });

    process.on('error', (err) => {
        console.error(`Failed to start subprocess: ${err.message}`);
    });

    process.on('close', (code) => {
        console.log(`Child process exited with code ${code}`);

        // 获取最新的检测结果目录
        const latestExpDir = getLatestExpDir();

        // 查找检测结果中的图片文件名
        const files = fs.readdirSync(latestExpDir);
        const detectedImage = files.find(file => /\.(jpg|jpeg|png)$/i.test(file));

        if (detectedImage) {
            const imagePath = path.join(latestExpDir, detectedImage);
            event.sender.send('detection-complete', { imagePath: imagePath });
        } else {
            console.log('No image found in the latest detection directory.');
        }
    });
});


ipcMain.on('upload-video', async (event) => {
    console.log(`Python Path: ${pythonPath}`);
    console.log(`Script Path: ${scriptPath}`);
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Videos', extensions: ['mp4', 'avi', 'mov'] }]
    });
    if (canceled || !filePaths || filePaths.length === 0) {
        console.log("Video selection canceled or invalid file path.");
        return;
    }

    console.log(`Selected video: ${filePaths[0]}`);

    const process = spawn(pythonPath, [scriptPath, '--source', filePaths[0]], {
        cwd: path.join(basePath, 'yolov5-master')
    });

    process.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
        event.sender.send('processing-progress', { message: 'Processing video...', data: data.toString() });
    });

    process.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
        event.sender.send('processing-progress', { message: 'Processing error...', data: data.toString() });
    });

    process.on('error', (err) => {
        console.error(`Failed to start subprocess: ${err.message}`);
    });

    process.on('close', (code) => {
        console.log(`Child process exited with code ${code}`);

        // 获取最新的检测结果目录
        const latestExpDir = getLatestExpDir();
        if (!latestExpDir) {
            console.log('Failed to get the latest experiment directory.');
            return;
        }

        // 查找检测结果中的视频文件名
        const files = fs.readdirSync(latestExpDir);
        const detectedVideo = files.find(file => /\.(mp4|avi|mov)$/i.test(file));

        if (detectedVideo) {
            const videoPath = path.join(latestExpDir, detectedVideo);

            // 启动 FFmpeg 转码
            transcodeVideo(event, videoPath);
        } else {
            console.log('No video found in the latest detection directory.');
        }
    });
});

function transcodeVideo(event, videoPath) {
    if (!videoPath) {
        console.log("Invalid video path.");
        return;
    }

    const outputPath = videoPath.replace(/\.(mp4|avi|mov)$/i, '_transcoded.mp4');
    const ffmpegProcess = spawn(ffmpegPath, [
        '-i', videoPath, // 输入文件
        '-c:v', 'libx264', // 视频编码器
        '-c:a', 'aac', // 音频编码器
        '-strict', 'experimental', // 使用 AAC 编码器
        outputPath // 输出文件
    ]);

    ffmpegProcess.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
    });

    ffmpegProcess.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    ffmpegProcess.on('error', (err) => {
        console.error(`Failed to start subprocess: ${err.message}`);
    });

    ffmpegProcess.on('close', (code) => {
        console.log(`FFmpeg process exited with code ${code}`);
        if (fs.existsSync(outputPath)) {
            console.log(`Transcoded video exists at ${outputPath}`);
            event.sender.send('detection-complete', { videoPath: outputPath });
        } else {
            console.error('Transcoded video not found.');
        }
    });
}

ipcMain.on('clear-content', (event) => {
    fs.emptyDir(detectDir, err => {
        if (err) {
            console.error(err);
            // 如果出错，可以发送错误消息到渲染进程（可选）
            event.sender.send('clear-content-error', 'Failed to clear content.');
        } else {
            console.log('Detect directory cleared.');
            // 成功后通知渲染进程清除页面上的预览内容
            event.sender.send('clear-content-success');
        }
    });
});


ipcMain.on('save-content', async (event) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Save Detection Result',
        defaultPath: path.join(basePath, 'detection-result'),
        filters: [
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png'] },
            { name: 'Videos', extensions: ['mp4', 'avi', 'mov'] }
        ]
    });

    if (!canceled && filePath) {
        try {
            const latestExpDir = getLatestExpDir();
            const files = fs.readdirSync(latestExpDir);
            const detectedFile = files.find(file => /\.(jpg|jpeg|png|mp4|avi|mov)$/i.test(file));

            if (detectedFile) {
                const sourcePath = path.join(latestExpDir, detectedFile);
                
                if (fs.existsSync(sourcePath)) {
                    const detectedFileExtension = path.extname(detectedFile).toLowerCase();
                    const saveFileExtension = path.extname(filePath).toLowerCase();
                    let destinationPath = filePath;

                    // 如果 filePath 已经包含了扩展名，并且与检测文件的扩展名不匹配，才添加正确的扩展名
                    if (saveFileExtension !== detectedFileExtension) {
                        destinationPath = filePath.replace(saveFileExtension, '') + detectedFileExtension;
                    }

                    fs.copyFile(sourcePath, destinationPath, (err) => {
                        if (err) {
                            console.error(`Error copying file: ${err.message}`);
                            event.sender.send('save-content-error', 'Error saving file.');
                        } else {
                            console.log(`File successfully saved to ${destinationPath}`);
                            event.sender.send('save-content-success', destinationPath);
                        }
                    });
                } else {
                    console.log('Source file does not exist.');
                    event.sender.send('save-content-error', 'Source file does not exist.');
                }
            } else {
                console.log('No file found to save.');
                event.sender.send('save-content-error', 'No file found to save.');
            }
        } catch (error) {
            console.error(`Error occurred: ${error.message}`);
            event.sender.send('save-content-error', 'Error occurred while saving file.');
        }
    }
});

