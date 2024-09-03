const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    startCameraDetection: (cameraIndex) => ipcRenderer.send('start-camera-detection', cameraIndex),
    onCameraDetectionError: (callback) => ipcRenderer.on('camera-detection-error', (event, message) => callback(message)),
    stopCameraDetection: () => ipcRenderer.send('stop-camera-detection'),

    uploadImage: () => ipcRenderer.send('upload-image'),
    uploadVideo: () => ipcRenderer.send('upload-video'),
    onVideoProcessed: (callback) => ipcRenderer.on('video-processed', (event, videoPath) => callback(videoPath)),
    onVideoProcessingError: (callback) => ipcRenderer.on('video-processing-error', (event, errorMessage) => callback(errorMessage)),

    // 检测完毕 
    onDetectionComplete: (callback) => ipcRenderer.on('detection-complete', (event, result) => callback(result)),
    clearContent: () => ipcRenderer.send('clear-content'), // 清空
    saveContent: () => ipcRenderer.send('save-content'), // 保存
    onSaveContentSuccess: (callback) => ipcRenderer.on('save-content-success', (event, filePath) => callback(filePath)),
    onSaveContentError: (callback) => ipcRenderer.on('save-content-error', (event, errorMessage) => callback(errorMessage)),
    onClearContentSuccess: (callback) => ipcRenderer.on('clear-content-success', () => callback()), // html清空

    // python
    selectPythonPath: () => ipcRenderer.send('select-python-path'),
    onPythonPathSelected: (callback) => ipcRenderer.on('python-path-selected', (event, path) => callback(path)),
    getPythonPath: () => ipcRenderer.invoke('get-python-path'),

    // 进度条
    onProcessingProgress: (callback) => ipcRenderer.on('processing-progress', callback),

});
