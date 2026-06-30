// Global State Management
const STATE = {
    currentTab: 'tts-tab',
    systemStatus: { has_vieneu: false, engine_loaded: false, device: 'CPU' },
    builtInVoices: [],
    clonedVoices: [], // loaded from backend and localStorage
    selectedVoiceId: 'hoai_nam', // default select
    selectedVoiceType: 'built-in', // 'built-in' or 'cloned'
    mediaRecorder: null,
    audioChunks: [],
    recordStartTime: null,
    recordTimerInterval: null,
    recordedBlob: null
};

// Toast Notifications Helper
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.className = `toast ${type}`;
    
    // Set appropriate icon
    const icon = toast.querySelector('.toast-icon');
    icon.className = 'fa-solid toast-icon';
    if (type === 'success') icon.classList.add('fa-circle-check');
    else if (type === 'error') icon.classList.add('fa-circle-exclamation');
    else if (type === 'warning') icon.classList.add('fa-triangle-exclamation');
    else icon.classList.add('fa-circle-info');
    
    toast.querySelector('.toast-message').textContent = message;
    
    // Reset animations
    toast.style.display = 'flex';
    toast.classList.remove('hidden');
    
    // Clear previous timeouts if any
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    
    window.toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
    }, 4000);
}

// ----------------------------------------------------
// UI TABS CONTROLLER
// ----------------------------------------------------
function initTabNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = item.getAttribute('data-tab');
            
            // Update active sidebar item
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Update active section content
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(targetTab).classList.add('active');
            
            STATE.currentTab = targetTab;
            
            // Customize Title & Subtitle based on tab
            const pageTitle = document.getElementById('page-title');
            const pageSubtitle = document.getElementById('page-subtitle');
            
            if (targetTab === 'tts-tab') {
                pageTitle.textContent = "Tạo Giọng Nói Tiếng Việt";
                pageSubtitle.textContent = "Nhập văn bản và chọn giọng nói để tổng hợp âm thanh chất lượng cao";
            } else if (targetTab === 'cloning-tab') {
                pageTitle.textContent = "Nhân Bản Giọng Nói (Voice Cloning)";
                pageSubtitle.textContent = "Upload hoặc thu âm giọng nói mẫu dài 3-5 giây để sao chép tức thì";
            } else if (targetTab === 'conversation-tab') {
                pageTitle.textContent = "Kịch Bản Hội Thoại & Podcast";
                pageSubtitle.textContent = "Phối hợp nhiều giọng nói khác nhau để tạo file audio hội thoại hoàn chỉnh";
                initConversationTab();
            } else if (targetTab === 'history-tab') {
                pageTitle.textContent = "Nhật Ký & Thư Viện Âm Thanh";
                pageSubtitle.textContent = "Xem, nghe và quản lý toàn bộ các tệp âm thanh đã được tạo ra offline";
                loadHistory();
            }
        });
    });
}

// ----------------------------------------------------
// STATUS & DIAGNOSTICS
// ----------------------------------------------------
async function checkSystemStatus() {
    const badge = document.getElementById('engine-status');
    const dot = badge.querySelector('.status-dot');
    const text = badge.querySelector('.status-text');
    
    dot.className = 'status-dot warning';
    text.textContent = 'Đang kết nối backend...';
    
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        STATE.systemStatus = data;
        
        if (data.has_vieneu) {
            dot.className = 'status-dot active';
            text.textContent = `VieNeu Live (${data.device})`;
            showToast("Hệ thống VieNeu-TTS sẵn sàng chạy offline!", "success");
            // Hide the client synth toggle since we have the real thing
            document.getElementById('client-synth-toggle-container').style.display = 'none';
        } else {
            dot.className = 'status-dot warning';
            text.textContent = 'Chế độ Mô Phỏng (Simulation)';
            showToast("Đang chạy ở chế độ Mô phỏng (chưa cài vieneu). Bạn vẫn có thể thử nghiệm mọi tính năng!", "warning");
            document.getElementById('client-synth-toggle-container').style.display = 'block';
        }
    } catch (error) {
        dot.className = 'status-dot error';
        text.textContent = 'Không có kết nối backend';
        showToast("Không thể kết nối tới FastAPI server. Hãy chạy 'run.bat' trước!", "error");
    }
}

// ----------------------------------------------------
// VOICES LIBRARY MANAGEMENT
// ----------------------------------------------------
async function loadVoices() {
    try {
        // 1. Load built-in voices
        const response = await fetch('/api/voices');
        const voices = await response.json();
        STATE.builtInVoices = voices;
        
        // 2. Load cloned voices from localStorage and state
        loadLocalClonedVoices();
        
        renderVoicesGrid();
    } catch (error) {
        showToast("Không thể tải danh sách giọng đọc", "error");
    }
}

function loadLocalClonedVoices() {
    const local = localStorage.getItem('cloned_voices');
    if (local) {
        try {
            STATE.clonedVoices = JSON.parse(local);
        } catch(e) {
            STATE.clonedVoices = [];
        }
    }
}

function saveLocalClonedVoices() {
    localStorage.setItem('cloned_voices', JSON.stringify(STATE.clonedVoices));
}

function renderVoicesGrid() {
    const listContainer = document.getElementById('built-in-voices-list');
    listContainer.innerHTML = '';
    
    if (STATE.builtInVoices.length === 0) {
        listContainer.innerHTML = '<p class="empty-state">Không có giọng nói mặc định nào.</p>';
        return;
    }
    
    STATE.builtInVoices.forEach(voice => {
        const isSelected = STATE.selectedVoiceType === 'built-in' && STATE.selectedVoiceId === voice.id;
        const isFemale = voice.gender === 'Nữ';
        const card = document.createElement('div');
        card.className = `voice-card ${isSelected ? 'selected' : ''}`;
        card.setAttribute('data-id', voice.id);
        card.setAttribute('data-type', 'built-in');
        
        card.innerHTML = `
            <div class="voice-meta">
                <div class="voice-avatar ${isFemale ? 'female' : ''}">
                    <i class="fa-solid ${isFemale ? 'fa-user-astronaut' : 'fa-user-tie'}"></i>
                </div>
                <div class="voice-details">
                    <span class="voice-name">${voice.name}</span>
                    <div class="voice-info-row">
                        <span>${voice.gender}</span>
                        <span>•</span>
                        <span>${voice.region}</span>
                    </div>
                </div>
            </div>
            <button class="btn-preview-voice" title="Nghe thử giọng mẫu" data-preview-voice="${voice.name}">
                <i class="fa-solid fa-circle-play"></i>
            </button>
        `;
        
        // Set click handlers
        card.addEventListener('click', (e) => {
            // Prevent voice preview button trigger
            if (e.target.closest('.btn-preview-voice')) return;
            selectVoice(voice.id, 'built-in');
        });
        
        const previewBtn = card.querySelector('.btn-preview-voice');
        previewBtn.addEventListener('click', () => {
            playVoicePreview(voice.name, voice.gender);
        });
        
        listContainer.appendChild(card);
    });
    
    // Render Cloned voices list
    renderClonedVoicesGrid();
}

function renderClonedVoicesGrid() {
    const listContainer = document.getElementById('cloned-voices-list');
    const clonedTabBtn = document.getElementById('tab-cloned-voices');
    listContainer.innerHTML = '';
    
    clonedTabBtn.textContent = `Đã Clone (${STATE.clonedVoices.length})`;
    
    if (STATE.clonedVoices.length === 0) {
        listContainer.innerHTML = `
            <p class="empty-state">
                Chưa có giọng nói clone nào.<br>
                Qua tab <strong>Nhân Bản Giọng Nói</strong> để tạo giọng đầu tiên!
            </p>
        `;
        return;
    }
    
    STATE.clonedVoices.forEach(voice => {
        const isSelected = STATE.selectedVoiceType === 'cloned' && STATE.selectedVoiceId === voice.id;
        const card = document.createElement('div');
        card.className = `voice-card ${isSelected ? 'selected' : ''}`;
        card.setAttribute('data-id', voice.id);
        card.setAttribute('data-type', 'cloned');
        
        card.innerHTML = `
            <div class="voice-meta">
                <div class="voice-avatar" style="background: rgba(0, 242, 254, 0.1); border-color: rgba(0, 242, 254, 0.2); color: var(--accent-cyan)">
                    <i class="fa-solid fa-fingerprint"></i>
                </div>
                <div class="voice-details">
                    <span class="voice-name">${voice.name}</span>
                    <div class="voice-info-row">
                        <span>Nhân bản</span>
                        <span>•</span>
                        <span>Offline</span>
                    </div>
                </div>
            </div>
        `;
        
        card.addEventListener('click', () => {
            selectVoice(voice.id, 'cloned');
        });
        
        listContainer.appendChild(card);
    });
}

function selectVoice(id, type) {
    STATE.selectedVoiceId = id;
    STATE.selectedVoiceType = type;
    
    // Deselect all cards
    document.querySelectorAll('.voice-card').forEach(card => card.classList.remove('selected'));
    
    // Select specific card
    const card = document.querySelector(`.voice-card[data-id="${id}"][data-type="${type}"]`);
    if (card) card.classList.add('selected');
}

function playVoicePreview(name, gender) {
    if ('speechSynthesis' in window) {
        // Stop any current synthesis
        window.speechSynthesis.cancel();
        
        const previewText = `Xin chào! Tôi là ${name}, đây là giọng nói mặc định của tôi trong hệ thống VieNeu-TTS.`;
        const utterance = new SpeechSynthesisUtterance(previewText);
        utterance.lang = 'vi-VN';
        
        // Try to match female/male voice profile in browser
        const browserVoices = window.speechSynthesis.getVoices();
        const viVoice = browserVoices.find(v => v.lang.includes('vi') || v.lang.includes('VI'));
        if (viVoice) utterance.voice = viVoice;
        
        window.speechSynthesis.speak(utterance);
        showToast(`Đang nghe thử giọng của ${name}...`, 'info');
    } else {
        showToast("Trình duyệt không hỗ trợ nghe thử bằng Web Speech API", "warning");
    }
}

// Setup voice tabs: Mặc định vs Đã clone
function initVoiceTabs() {
    const tabs = document.querySelectorAll('.voice-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const targetType = tab.getAttribute('data-type');
            document.getElementById('built-in-voices-list').classList.remove('active');
            document.getElementById('cloned-voices-list').classList.remove('active');
            
            if (targetType === 'built-in') {
                document.getElementById('built-in-voices-list').classList.add('active');
            } else {
                document.getElementById('cloned-voices-list').classList.add('active');
            }
        });
    });
}

// ----------------------------------------------------
// SINGLE SPEECH GENERATION (TTS)
// ----------------------------------------------------
async function generateTTS() {
    const textInput = document.getElementById('tts-text');
    const text = textInput.value.trim();
    if (!text) {
        showToast("Vui lòng nhập văn bản cần chuyển thành giọng nói!", "warning");
        return;
    }
    
    // Get parameters
    const speed = parseFloat(document.getElementById('setting-speed').value);
    const mode = document.getElementById('setting-mode').value;
    const clientSynth = document.getElementById('setting-client-synth').checked;
    
    // Find current voice representation
    let voiceName = "Hoài Nam";
    let refAudioId = null;
    
    if (STATE.selectedVoiceType === 'built-in') {
        const selected = STATE.builtInVoices.find(v => v.id === STATE.selectedVoiceId);
        if (selected) voiceName = selected.name;
    } else {
        const selected = STATE.clonedVoices.find(v => v.id === STATE.selectedVoiceId);
        if (selected) {
            refAudioId = selected.filename; // filename stored on upload
            voiceName = "Cloned";
        }
    }
    
    const generateBtn = document.getElementById('btn-generate-tts');
    const originalText = generateBtn.querySelector('span').textContent;
    generateBtn.disabled = true;
    generateBtn.querySelector('span').textContent = "Đang xử lý...";
    generateBtn.querySelector('i').className = "fa-solid fa-spinner fa-spin";
    
    try {
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                voice: voiceName,
                ref_audio: refAudioId,
                speed: speed,
                mode: mode
            })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Lỗi tổng hợp âm thanh");
        }
        
        const data = await response.json();
        
        // Show result panel
        const resultPanel = document.getElementById('audio-result-panel');
        resultPanel.classList.remove('hidden');
        
        const badgeEngine = document.getElementById('res-badge-engine');
        badgeEngine.textContent = data.mode === 'live' ? 'Chế độ: VieNeu Live' : 'Chế độ: Mô phỏng';
        badgeEngine.className = `badge ${data.mode === 'live' ? 'success' : 'warning'}`;
        
        document.getElementById('res-badge-voice').textContent = `Giọng đọc: ${data.voice}`;
        
        const audioEl = document.getElementById('result-audio-element');
        audioEl.src = data.audio_url;
        audioEl.load();
        
        const downloadBtn = document.getElementById('btn-download-audio');
        downloadBtn.href = data.audio_url;
        
        // HTML5 Canvas Waveform Rendering
        setupWaveformVisualizer(audioEl);
        
        showToast("Tổng hợp giọng nói thành công!", "success");
        
        // CLIENT-SIDE SYNTHESIS FALLBACK
        // If simulation mode and user opted to read using browser Speech Synthesis
        if (data.mode === 'simulation' && clientSynth && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'vi-VN';
            utterance.rate = speed;
            
            // match gender pitch
            const browserVoices = window.speechSynthesis.getVoices();
            const viVoice = browserVoices.find(v => v.lang.includes('vi') || v.lang.includes('VI'));
            if (viVoice) utterance.voice = viVoice;
            
            window.speechSynthesis.speak(utterance);
        }
        
        // Scroll to result panel
        resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
    } catch (error) {
        showToast(`Lỗi: ${error.message}`, "error");
    } finally {
        generateBtn.disabled = false;
        generateBtn.querySelector('span').textContent = originalText;
        generateBtn.querySelector('i').className = "fa-solid fa-play";
    }
}

// Waveform visualizer
function setupWaveformVisualizer(audioEl) {
    const canvas = document.getElementById('waveform-canvas');
    if (!canvas) return;
    
    // Draw initial waveform
    drawStaticWaveform(canvas, 0);
    
    // Listen to time updates to animate progress
    audioEl.addEventListener('timeupdate', () => {
        const progress = audioEl.currentTime / audioEl.duration || 0;
        drawStaticWaveform(canvas, progress);
    });
}

function drawStaticWaveform(canvas, progress) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.parentElement.clientWidth;
    const height = canvas.height = canvas.parentElement.clientHeight || 48;
    
    ctx.clearRect(0, 0, width, height);
    
    const barCount = 75;
    const barWidth = 3;
    const gap = 3;
    const totalWidth = barCount * (barWidth + gap);
    const startX = (width - totalWidth) / 2;
    
    // Fixed seed for shape consistency
    let seed = 120;
    function random() {
        let x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    }
    
    for (let i = 0; i < barCount; i++) {
        const ratio = i / barCount;
        const bellCurve = Math.sin(ratio * Math.PI); // shape it like a bell
        const barHeight = (height * 0.75) * bellCurve * (0.3 + 0.7 * random());
        const x = startX + i * (barWidth + gap);
        const y = (height - barHeight) / 2;
        
        const isPlayed = (i / barCount) <= progress;
        ctx.fillStyle = isPlayed ? '#00f2fe' : 'rgba(255, 255, 255, 0.15)';
        
        ctx.beginPath();
        // custom rounded rect
        ctx.roundRect(x, y, barWidth, barHeight, 1.5);
        ctx.fill();
    }
}

// ----------------------------------------------------
// VOICE CLONING (RECORD & UPLOAD)
// ----------------------------------------------------
function initVoiceCloning() {
    // Drop Zone Setup
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('clone-file-input');
    
    dropZone.addEventListener('click', () => fileInput.click());
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleSelectedFile(e.dataTransfer.files[0]);
        }
    });
    
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            handleSelectedFile(fileInput.files[0]);
        }
    });
    
    document.getElementById('btn-remove-file').addEventListener('click', () => {
        clearFileUploader();
    });
    
    // Mic Recording Setup
    const micBtn = document.getElementById('mic-btn');
    micBtn.addEventListener('click', () => {
        toggleMicrophoneRecording();
    });
    
    // Clone sources selector
    const sourceTabs = document.querySelectorAll('.source-tab');
    sourceTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            sourceTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const targetSource = tab.getAttribute('data-source');
            document.getElementById('upload-source').classList.remove('active');
            document.getElementById('record-source').classList.remove('active');
            
            document.getElementById(targetSource).classList.add('active');
            
            // stop recording if tab switched
            if (targetSource !== 'record-source' && STATE.mediaRecorder && STATE.mediaRecorder.state === 'recording') {
                stopMicrophoneRecording(true);
            }
        });
    });
    
    // Submit Clone voice
    document.getElementById('btn-submit-clone').addEventListener('click', submitVoiceCloning);
    
    renderFullClonedLibrary();
}

function handleSelectedFile(file) {
    if (!file.type.startsWith('audio/')) {
        showToast("Vui lòng tải tệp âm thanh (WAV, MP3, M4A)!", "error");
        return;
    }
    
    STATE.recordedBlob = file;
    
    // Show File Preview bar
    const preview = document.getElementById('file-preview-bar');
    preview.classList.remove('hidden');
    
    document.getElementById('preview-file-name').textContent = file.name;
    document.getElementById('preview-file-size').textContent = formatBytes(file.size);
    
    // Autofill name from file
    const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const formattedName = baseName.replace(/[-_]/g, ' ');
    const nameInput = document.getElementById('clone-voice-name');
    if (!nameInput.value) {
        nameInput.value = formattedName;
    }
    
    showToast("Đã tải file âm thanh thành công!", "success");
}

function clearFileUploader() {
    STATE.recordedBlob = null;
    document.getElementById('clone-file-input').value = '';
    document.getElementById('file-preview-bar').classList.add('hidden');
}

// Mic Recording functions
async function toggleMicrophoneRecording() {
    const micBtn = document.getElementById('mic-btn');
    const micStatus = document.getElementById('mic-status');
    const timer = document.getElementById('record-timer');
    const visual = document.getElementById('recording-visual');
    
    if (STATE.mediaRecorder && STATE.mediaRecorder.state === 'recording') {
        // Stop recording
        stopMicrophoneRecording();
        return;
    }
    
    // Start recording
    STATE.audioChunks = [];
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        STATE.mediaRecorder = new MediaRecorder(stream);
        
        STATE.mediaRecorder.addEventListener('dataavailable', (e) => {
            if (e.data.size > 0) STATE.audioChunks.push(e.data);
        });
        
        STATE.mediaRecorder.addEventListener('stop', () => {
            STATE.recordedBlob = new Blob(STATE.audioChunks, { type: 'audio/wav' });
            
            // Create a pseudo file name
            const timestamp = new Date().toISOString().slice(0,10);
            const mockFile = new File([STATE.recordedBlob], `GhiAm_${timestamp}.wav`, { type: 'audio/wav' });
            
            // Switch back to upload tab to show file
            document.querySelector('.source-tab[data-source="upload-source"]').click();
            handleSelectedFile(mockFile);
            
            // Clean up stream tracks
            stream.getTracks().forEach(track => track.stop());
        });
        
        STATE.mediaRecorder.start();
        STATE.recordStartTime = Date.now();
        
        // UI updates
        micBtn.classList.add('recording');
        micStatus.textContent = "Đang thu âm... Click vào mic lần nữa để dừng";
        timer.classList.remove('hidden');
        visual.classList.remove('hidden');
        
        // Start counter
        timer.textContent = "00:00";
        STATE.recordTimerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - STATE.recordStartTime) / 1000);
            const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
            const secs = String(elapsed % 60).padStart(2, '0');
            timer.textContent = `${mins}:${secs}`;
            
            // Suggest stop after 5 seconds
            if (elapsed >= 5 && elapsed <= 6) {
                micStatus.textContent = "Thời lượng tối ưu (3-5s). Bạn có thể click dừng lại.";
            }
        }, 1000);
        
    } catch (err) {
        showToast("Không thể truy cập microphone. Vui lòng cấp quyền!", "error");
    }
}

function stopMicrophoneRecording(cancel = false) {
    const micBtn = document.getElementById('mic-btn');
    const micStatus = document.getElementById('mic-status');
    const timer = document.getElementById('record-timer');
    const visual = document.getElementById('recording-visual');
    
    if (STATE.mediaRecorder) {
        if (cancel) {
            // override handler to prevent saving
            STATE.mediaRecorder.onstop = () => {};
        }
        STATE.mediaRecorder.stop();
    }
    
    clearInterval(STATE.recordTimerInterval);
    
    micBtn.classList.remove('recording');
    micStatus.textContent = "Click vào mic để bắt đầu ghi âm";
    timer.classList.add('hidden');
    visual.classList.add('hidden');
}

async function submitVoiceCloning() {
    const nameInput = document.getElementById('clone-voice-name');
    const name = nameInput.value.trim();
    
    if (!name) {
        showToast("Vui lòng đặt tên cho giọng nói clone này!", "warning");
        return;
    }
    if (!STATE.recordedBlob) {
        showToast("Vui lòng tải lên file hoặc ghi âm giọng nói mẫu!", "warning");
        return;
    }
    
    const submitBtn = document.getElementById('btn-submit-clone');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang phân tích âm sắc...';
    
    const formData = new FormData();
    formData.append('file', STATE.recordedBlob);
    formData.append('name', name);
    
    try {
        const response = await fetch('/api/upload-ref', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || "Lỗi tải lên file tham chiếu");
        }
        
        const data = await response.json();
        
        // Add to local state
        const newVoice = {
            id: data.id,
            name: data.name,
            filename: data.filename,
            created_at: new Date().toLocaleDateString('vi-VN')
        };
        
        STATE.clonedVoices.unshift(newVoice);
        saveLocalClonedVoices();
        
        // Reload grids
        renderVoicesGrid();
        renderFullClonedLibrary();
        
        // Reset cloning inputs
        nameInput.value = '';
        clearFileUploader();
        
        showToast("Đã trích xuất và lưu giọng clone mới thành công!", "success");
        
    } catch(err) {
        showToast(`Không thể trích xuất: ${err.message}`, "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

function renderFullClonedLibrary() {
    const list = document.getElementById('library-list-full');
    list.innerHTML = '';
    
    if (STATE.clonedVoices.length === 0) {
        list.innerHTML = '<p class="empty-state">Chưa có giọng nói clone nào được lưu.</p>';
        return;
    }
    
    STATE.clonedVoices.forEach(voice => {
        const item = document.createElement('div');
        item.className = 'library-item';
        
        item.innerHTML = `
            <div class="item-left">
                <div class="voice-avatar" style="background: rgba(0, 242, 254, 0.1); border-color: rgba(0, 242, 254, 0.2); color: var(--accent-cyan)">
                    <i class="fa-solid fa-fingerprint"></i>
                </div>
                <div class="item-meta">
                    <span class="item-name">${voice.name}</span>
                    <span class="item-date">Tạo ngày: ${voice.created_at || 'Mới'}</span>
                </div>
            </div>
            <div class="item-actions">
                <button class="btn btn-danger btn-icon-only btn-delete-clone" data-id="${voice.id}" title="Xóa giọng này">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
        
        const deleteBtn = item.querySelector('.btn-delete-clone');
        deleteBtn.addEventListener('click', () => {
            deleteClonedVoice(voice.id);
        });
        
        list.appendChild(item);
    });
}

function deleteClonedVoice(id) {
    if (confirm("Bạn có chắc chắn muốn xóa giọng đọc đã clone này?")) {
        STATE.clonedVoices = STATE.clonedVoices.filter(v => v.id !== id);
        saveLocalClonedVoices();
        
        // Reset selections if the deleted voice was active
        if (STATE.selectedVoiceType === 'cloned' && STATE.selectedVoiceId === id) {
            STATE.selectedVoiceType = 'built-in';
            STATE.selectedVoiceId = 'hoai_nam';
        }
        
        renderVoicesGrid();
        renderFullClonedLibrary();
        showToast("Đã xóa giọng đọc khỏi thư viện.", "success");
    }
}

// ----------------------------------------------------
// PODCAST & CONVERSATION SCRIPT WRITER
// ----------------------------------------------------
let rowCounter = 0;

function initConversationTab() {
    const timeline = document.getElementById('conversation-timeline');
    if (timeline.children.length === 0) {
        // Add 2 default rows to show how it works
        addDialogueRow("hoai_nam", "built-in", "Chào chị Thảo Vy! Chị đã nghe tin gì về dự án VieNeu-TTS này chưa?");
        addDialogueRow("thao_vy", "built-in", "Chào anh Hoài Nam. Tôi nghe nói dự án này giúp clone giọng nói offline nhanh lắm đấy!");
    }
}

function addDialogueRow(defaultSpeaker = "hoai_nam", defaultType = "built-in", defaultText = "") {
    const timeline = document.getElementById('conversation-timeline');
    const rowId = `dialogue-row-${rowCounter++}`;
    
    const row = document.createElement('div');
    row.className = 'dialogue-row';
    row.id = rowId;
    
    // Compile speaker select options
    let builtInOptions = STATE.builtInVoices.map(v => 
        `<option value="built-in:${v.name}" ${defaultType==='built-in'&&v.id===defaultSpeaker?'selected':''}>${v.name} (${v.gender})</option>`
    ).join('');
    
    let clonedOptions = STATE.clonedVoices.map(v => 
        `<option value="cloned:${v.filename}" ${defaultType==='cloned'&&v.id===defaultSpeaker?'selected':''}>${v.name} (Clone)</option>`
    ).join('');
    
    row.innerHTML = `
        <div class="row-speaker">
            <select class="select-input select-row-speaker">
                <optgroup label="Giọng Mặc Định">
                    ${builtInOptions}
                </optgroup>
                ${STATE.clonedVoices.length > 0 ? `<optgroup label="Giọng Đã Clone">${clonedOptions}</optgroup>` : ''}
            </select>
            <span class="badge row-speaker-badge">Giọng chuẩn</span>
        </div>
        <div class="row-text">
            <textarea placeholder="Nhập câu hội thoại ở đây..." class="text-input textarea-row-text">${defaultText}</textarea>
        </div>
        <div>
            <button class="btn-remove-row" title="Xóa dòng thoại"><i class="fa-solid fa-xmark"></i></button>
        </div>
    `;
    
    // Delete row event
    row.querySelector('.btn-remove-row').addEventListener('click', () => {
        if (timeline.children.length > 1) {
            row.remove();
            updateDialogueRowLabels();
        } else {
            showToast("Kịch bản cần có ít nhất 1 câu thoại!", "warning");
        }
    });
    
    // Speaker select change event to update badges
    const select = row.querySelector('.select-row-speaker');
    const badge = row.querySelector('.row-speaker-badge');
    
    const updateBadge = () => {
        const val = select.value;
        if (val.startsWith('cloned:')) {
            badge.textContent = "Giọng Clone";
            badge.style.borderColor = 'rgba(0, 242, 254, 0.2)';
            badge.style.color = 'var(--accent-cyan)';
        } else {
            badge.textContent = "Giọng chuẩn";
            badge.style.borderColor = 'rgba(157, 78, 221, 0.2)';
            badge.style.color = 'var(--text-secondary)';
        }
    };
    
    select.addEventListener('change', updateBadge);
    updateBadge(); // set initially
    
    timeline.appendChild(row);
    updateDialogueRowLabels();
}

function updateDialogueRowLabels() {
    // Scroll to bottom of timeline
    const timeline = document.getElementById('conversation-timeline');
    timeline.scrollTop = timeline.scrollHeight;
}

async function generateConversation() {
    const timeline = document.getElementById('conversation-timeline');
    const rows = timeline.querySelectorAll('.dialogue-row');
    const lines = [];
    
    let hasEmpty = false;
    rows.forEach(row => {
        const speakerVal = row.querySelector('.select-row-speaker').value;
        const text = row.querySelector('.textarea-row-text').value.trim();
        
        if (!text) {
            hasEmpty = true;
            row.classList.add('error-pulse');
            setTimeout(() => row.classList.remove('error-pulse'), 1500);
        }
        
        const [type, speakerName] = speakerVal.split(':');
        lines.push({
            speaker: speakerName,
            speaker_type: type,
            text: text
        });
    });
    
    if (hasEmpty) {
        showToast("Không được để trống nội dung câu thoại!", "warning");
        return;
    }
    
    const mode = document.getElementById('setting-mode').value;
    const mergeBtn = document.getElementById('btn-generate-conversation');
    const originalText = mergeBtn.innerHTML;
    mergeBtn.disabled = true;
    mergeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tổng hợp từng câu & ghép âm...';
    
    try {
        const response = await fetch('/api/conversation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lines: lines,
                mode: mode
            })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Lỗi ghép nối hội thoại");
        }
        
        const data = await response.json();
        
        // Show result panel
        const resultPanel = document.getElementById('conversation-result-panel');
        resultPanel.classList.remove('hidden');
        
        document.getElementById('conv-badge-engine').textContent = data.mode === 'live' ? 'Chế độ: VieNeu Live' : 'Chế độ: Mô phỏng';
        document.getElementById('conv-badge-engine').className = `badge ${data.mode === 'live' ? 'success' : 'warning'}`;
        document.getElementById('conv-badge-lines').textContent = `Số câu thoại: ${data.lines_processed}`;
        
        const audioEl = document.getElementById('conversation-audio-element');
        audioEl.src = data.audio_url;
        audioEl.load();
        
        document.getElementById('btn-download-conv').href = data.audio_url;
        
        showToast("Đã xuất podcast hội thoại thành công!", "success");
        
        resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
    } catch(err) {
        showToast(`Không thể tạo hội thoại: ${err.message}`, "error");
    } finally {
        mergeBtn.disabled = false;
        mergeBtn.innerHTML = originalText;
    }
}

// ----------------------------------------------------
// HISTORY & ARCHIVES TABS
// ----------------------------------------------------
async function loadHistory() {
    const tbody = document.getElementById('history-list-body');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner m-auto"></div> Tải danh sách...</td></tr>';
    
    try {
        const response = await fetch('/api/history');
        const files = await response.json();
        
        tbody.innerHTML = '';
        
        if (files.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Chưa có bản ghi âm thanh nào trong lịch sử.</td></tr>';
            return;
        }
        
        files.forEach(file => {
            const tr = document.createElement('tr');
            
            // Format time
            const date = new Date(file.created_at * 1000);
            const timeStr = date.toLocaleString('vi-VN', { hour: '2-digit', minute:'2-digit', second:'2-digit', day:'numeric', month:'numeric' });
            
            // Guess voice & content from filename (or fetch if tracked)
            // For now parse standard details
            const isConv = file.filename.startsWith('conversation_');
            const displayText = isConv ? `Kịch bản Podcast (${file.filename.substring(13, 21)})` : `Tổng hợp TTS (${file.filename.substring(4, 12)})`;
            const displayVoice = isConv ? 'Nhiều người nói' : 'Đơn';
            
            tr.innerHTML = `
                <td><strong>${timeStr}</strong></td>
                <td><div class="history-text" title="${file.filename}">${displayText}</div></td>
                <td><span class="badge">${displayVoice}</span></td>
                <td>${formatBytes(file.size)}</td>
                <td>
                    <audio src="${file.audio_url}" controls preload="none"></audio>
                </td>
                <td>
                    <button class="btn btn-danger btn-icon-only btn-delete-history" data-filename="${file.filename}" title="Xóa">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            `;
            
            tr.querySelector('.btn-delete-history').addEventListener('click', () => {
                deleteHistoryItem(file.filename);
            });
            
            tbody.appendChild(tr);
        });
        
    } catch(err) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4" style="color: var(--error)">Lỗi kết nối tới cơ sở dữ liệu lịch sử.</td></tr>';
    }
}

async function deleteHistoryItem(filename) {
    if (confirm(`Bạn có chắc chắn muốn xóa bản ghi này?`)) {
        try {
            const response = await fetch(`/api/history/${filename}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                showToast("Đã xóa bản ghi.", "success");
                loadHistory();
            } else {
                throw new Error();
            }
        } catch(e) {
            showToast("Không thể xóa file", "error");
        }
    }
}

// ----------------------------------------------------
// UTILITIES & SETUP
// ----------------------------------------------------
function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Initializer
window.addEventListener('DOMContentLoaded', () => {
    // 1. Navigation
    initTabNavigation();
    
    // 2. Load System Diagnostic status
    checkSystemStatus();
    document.getElementById('btn-refresh-status').addEventListener('click', checkSystemStatus);
    
    // 3. Load voices lists
    loadVoices();
    initVoiceTabs();
    
    // 4. Form operations
    document.getElementById('btn-clear-text').addEventListener('click', () => {
        document.getElementById('tts-text').value = '';
        document.getElementById('char-counter').textContent = "0 / 2000 ký tự";
    });
    
    // Text limits counter
    const ttsText = document.getElementById('tts-text');
    ttsText.addEventListener('input', () => {
        const len = ttsText.value.length;
        document.getElementById('char-counter').textContent = `${len} / 2000 ký tự`;
    });
    
    // Tags injection helper
    document.querySelectorAll('.tag-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tag = btn.getAttribute('data-tag');
            const startPos = ttsText.selectionStart;
            const endPos = ttsText.selectionEnd;
            const originalVal = ttsText.value;
            
            ttsText.value = originalVal.substring(0, startPos) + tag + originalVal.substring(endPos);
            ttsText.focus();
            ttsText.selectionStart = ttsText.selectionEnd = startPos + tag.length;
            
            // trigger counter
            document.getElementById('char-counter').textContent = `${ttsText.value.length} / 2000 ký tự`;
        });
    });
    
    // Generate voice handler
    document.getElementById('btn-generate-tts').addEventListener('click', generateTTS);
    
    // Speed slider display update
    const speedSlider = document.getElementById('setting-speed');
    speedSlider.addEventListener('input', () => {
        document.getElementById('val-speed').textContent = `${speedSlider.value}x`;
    });
    
    // 5. Cloning initialization
    initVoiceCloning();
    
    // 6. Conversation settings
    document.getElementById('btn-add-dialogue-row').addEventListener('click', () => {
        // pick random defaults
        const speakers = ['hoai_nam', 'phuong_thao', 'xuan_vinh', 'thao_vy'];
        const randomSpeaker = speakers[Math.floor(Math.random() * speakers.length)];
        addDialogueRow(randomSpeaker, "built-in", "");
    });
    
    document.getElementById('btn-clear-conversation').addEventListener('click', () => {
        if (confirm("Xóa toàn bộ kịch bản hiện tại?")) {
            document.getElementById('conversation-timeline').innerHTML = '';
            showToast("Đã xóa kịch bản.", "info");
        }
    });
    
    document.getElementById('btn-generate-conversation').addEventListener('click', generateConversation);
    
    // 7. History refresh
    document.getElementById('btn-refresh-history').addEventListener('click', loadHistory);
});
