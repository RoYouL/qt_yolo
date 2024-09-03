// 在页面加载时请求 Python 路径并更新输入框
document.addEventListener('DOMContentLoaded', () => {
    const pythonPathInput = document.getElementById('python-path');

    if (pythonPathInput) {
        // 请求 Python 路径
        window.electronAPI.getPythonPath().then((path) => {
            pythonPathInput.value = path;  // 显示当前 Python 路径
        }).catch((error) => {
            console.error('Failed to get Python path:', error);
        });
    }
    document.getElementById('start-camera').addEventListener('click', () => {
        const cameraSelect = document.getElementById('camera-select');
        const cameraIndex = cameraSelect.value;

        window.electronAPI.startCameraDetection(cameraIndex);
    });

    document.getElementById('stop-camera').addEventListener('click', () => {
        window.electronAPI.stopCameraDetection();
    });


    // 监听错误信息并展示
    window.electronAPI.onCameraDetectionError((errorMessage) => {
        const errorElement = document.getElementById('error-message');
        errorElement.textContent = `info: ${errorMessage}`;
        errorElement.style.display = 'block';  // 显示错误信息元素
    });


    document.getElementById('upload-image').addEventListener('click', () => {
        window.electronAPI.uploadImage();
    });

    document.getElementById('upload-video').addEventListener('click', () => {
        window.electronAPI.uploadVideo();
    });

    // 视频转码
    window.electronAPI.onVideoProcessed((videoPath) => {
        const videoPreview = document.getElementById('video-preview');
        videoPreview.src = `file://${videoPath}`;
        videoPreview.style.display = 'block';
    });

    window.electronAPI.onVideoProcessingError((errorMessage) => {
        const errorElement = document.getElementById('error-message');
        errorElement.textContent = `info: ${errorMessage}`;
        errorElement.style.display = 'block';  // 显示错误信息元素
    });

    document.getElementById('clear-content').addEventListener('click', () => {
        window.electronAPI.clearContent();
    });

    document.getElementById('save-content').addEventListener('click', () => {
        window.electronAPI.saveContent();
    });
    window.electronAPI.onSaveContentSuccess((filePath) => {
        alert(`File successfully saved to ${filePath}`);
    });
    window.electronAPI.onSaveContentError((errorMessage) => {
        alert(`Error: ${errorMessage}`);
    });

    window.electronAPI.onProcessingProgress(() => {
        const progressElement = document.getElementById('progress-message');
        progressElement.textContent = "检测中";
        progressElement.style.display = 'block';
    });


    // 监听检测完成事件并展示结果
    window.electronAPI.onDetectionComplete(({ imagePath, videoPath }) => {
        const progressElement = document.getElementById('progress-message');
        progressElement.style.display = 'none'; // 隐藏进度信息

        const imagePreview = document.getElementById('image-preview');
        const videoPreview = document.getElementById('video-preview');

        if (imagePath) {
            // 显示图片，隐藏视频
            imagePreview.src = `file://${imagePath}`;
            imagePreview.style.display = 'block';
            videoPreview.style.display = 'none';
            videoPreview.src = ''; // 清空视频路径
        } else if (videoPath) {
            // 显示视频，隐藏图片
            videoPreview.src = `file://${videoPath}`;
            videoPreview.style.display = 'block';
            imagePreview.style.display = 'none';
            imagePreview.src = ''; // 清空图片路径
        } else {
            // 如果两者都没有，隐藏两个
            imagePreview.style.display = 'none';
            imagePreview.src = '';
            videoPreview.style.display = 'none';
            videoPreview.src = '';
        }
    });


    // 清空图片
    window.electronAPI.onClearContentSuccess(() => {
        const imagePreview = document.getElementById('image-preview');
        const videoPreview = document.getElementById('video-preview');

        imagePreview.style.display = 'none';
        imagePreview.src = ''; // 清空图片路径

        videoPreview.style.display = 'none';
        videoPreview.src = ''; // 清空视频路径

        const errorElement = document.getElementById('error-message');
        errorElement.style.display = 'none'; // 隐藏错误信息
    });


    document.getElementById('select-python-path').addEventListener('click', () => {
        window.electronAPI.selectPythonPath();  // 触发选择 Python 路径的操作
    });

    window.electronAPI.onPythonPathSelected((path) => {
        document.getElementById('python-path').value = path;  // 显示当前 Python 路径
    });

})

