# 🎙️ Vietnamese TTS Workbench & Voice Cloning

Ứng dụng Web UI chạy cục bộ (local/offline) cho phép tổng hợp giọng nói tiếng Việt chất lượng cao và nhân bản giọng nói tức thì (Zero-shot Voice Cloning) dựa trên mô hình **VieNeu-TTS** (của tác giả Phạm Nguyễn Ngọc Bảo) và tích hợp các tính năng giống **Vbee**.

Dự án này được thiết kế để hoạt động ngay lập tức dưới dạng **Mô phỏng (Simulation)** qua Web Speech API của trình duyệt hoặc chạy **Trực tiếp (Live)** bằng mô hình học máy VieNeu-TTS tối ưu hóa trên CPU/GPU.

---

## ✨ Tính năng nổi bật

1. **Tạo giọng nói đơn (Text-to-Speech):**
   - Hỗ trợ xen kẽ từ tiếng Anh và tiếng Việt (Code-switching).
   - Hỗ trợ chèn các thẻ cảm xúc/phi ngôn ngữ: `[cười]`, `[thở dài]`, `[thì thầm]`, `[ngạc nhiên]`, `[do dự]`.
   - Lựa chọn nhiều giọng chuẩn miền Bắc/Nam mặc định.

2. **Nhân bản giọng nói (Zero-shot Voice Cloning):**
   - Clone giọng nói của bất kỳ ai chỉ với **3-5 giây âm thanh mẫu**.
   - Hỗ trợ tải tệp âm thanh có sẵn (`.wav`, `.mp3`) hoặc **thu âm trực tiếp từ microphone** trên Web UI.
   - Quản lý thư viện giọng nói đã clone và sử dụng lại bất cứ lúc nào.

3. **Biên tập hội thoại & Podcast (Conversation Mode):**
   - Giao diện dạng dòng thời gian (Timeline) cho phép tạo kịch bản nhiều người nói.
   - Phân vai người nói (giọng mặc định hoặc giọng đã clone) cho từng dòng thoại.
   - Tự động ghép nối các phân đoạn âm thanh thành một file podcast duy nhất hoàn chỉnh.

4. **Trình phát âm thanh & Thiết kế Premium:**
   - Giao diện tối hiện đại (Cyber glassmorphism) với các hiệu ứng chuyển động mượt mà.
   - Trình hiển thị dạng sóng âm thanh (Waveform Visualizer) động vẽ trực tiếp trên HTML5 Canvas.
   - Nhật ký lịch sử lưu trữ toàn bộ các file âm thanh đã tạo giúp tải về hoặc phát lại offline.

---

## 🛠️ Công nghệ sử dụng

- **Backend:** FastAPI (Python), Uvicorn.
- **Frontend:** HTML5, CSS3 (Vanilla), JavaScript (Vanilla).
- **Core Engine:** [VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS) (v3 Turbo / v2 Standard).
- **Fallback:** Web Speech API (Vietnamese Speech Synthesis) giúp chạy demo không cần cài model nặng.

---

## 🚀 Hướng dẫn cài đặt & Khởi chạy

Dự án được tối ưu hóa cho Windows và có kèm trình tải tự động `run.bat`.

### Bước 1: Khởi chạy nhanh (Chế độ Mô phỏng / Demo)
Chỉ cần nhấp đúp vào file `run.bat` trên Windows. File này sẽ tự động:
1. Tạo môi trường ảo Python (`.venv`).
2. Cài đặt các thư viện backend cơ bản (FastAPI, Uvicorn, v.v.).
3. Tự động mở trình duyệt tại địa chỉ `http://127.0.0.1:8000`.
4. Khởi động server.

*Ở chế độ này, khi bạn tạo giọng đọc, hệ thống sẽ sử dụng giọng đọc tiếng Việt tích hợp sẵn của trình duyệt (Google/Microsoft Vi-VN) làm fallback để bạn có thể trải nghiệm giao diện và quy trình ngay lập tức mà không cần tải dữ liệu hàng GB.*

---

### Bước 2: Nâng cấp lên chạy LIVE Offline (VieNeu-TTS)
Để chạy các mô hình AI thực tế chạy hoàn toàn offline trên thiết bị của bạn:

Kích hoạt môi trường ảo trong terminal của bạn:
```powershell
.venv\Scripts\activate
```

#### A. Nếu chạy bằng CPU (Dành cho máy cấu hình văn phòng hoặc không có card NVIDIA):
Cài đặt thư viện `vieneu` với bánh xe biên dịch sẵn `llama-cpp-python` để tránh lỗi biên dịch C++ trên Windows:
```bash
pip install vieneu --extra-index-url https://pnnbao97.github.io/llama-cpp-python-v0.3.16/cpu/
```

#### B. Nếu máy có card màn hình NVIDIA (GPU - Chạy siêu nhanh):
Cài đặt phiên bản hỗ trợ GPU CUDA:
```bash
pip install "vieneu[gpu]"
```

Khi chạy server lần đầu ở chế độ Live, thư viện `vieneu` sẽ tự động tải các tệp trọng số mô hình từ HuggingFace về máy và lưu trữ cục bộ cho các lần chạy sau.

---

## 📁 Cấu trúc thư mục

```text
vietnamese-tts-workbench/
├── .gitignore
├── README.md               # Hướng dẫn sử dụng
├── requirements.txt        # Các thư viện Python cần thiết
├── main.py                 # File chạy chính FastAPI backend
├── run.bat                 # File khởi động nhanh cho Windows
└── static/                 # Tài nguyên Frontend tĩnh
    ├── index.html          # Cấu trúc giao diện
    ├── styles.css          # Giao diện Glassmorphism
    └── app.js              # Xử lý Logic, Record, Canvas Waveform
```

---

## 📜 Lưu ý sử dụng
*Vui lòng tuân thủ các quy định về đạo đức AI. Hãy chỉ nhân bản giọng nói của chính bạn, người thân, đồng nghiệp, giáo viên hoặc bất kỳ ai đã cung cấp sự đồng ý rõ ràng. Không sử dụng công cụ để clone giọng nói của người khác mà không có sự đồng ý hoặc cho các mục đích mạo danh, lừa đảo.*
