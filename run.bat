@echo off
title Vietnamese TTS Workbench Loader
echo ==============================================================
echo        VIETNAMESE TTS WORKBENCH - OFFLINE STUDIO
echo ==============================================================
echo.

:: Check python installation
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in system PATH!
    echo Please install Python 3.10+ and check "Add Python to PATH" during setup.
    pause
    exit /b 1
)

:: Create Virtual Environment if not exists
if not exist .venv (
    echo [.venv] Creating virtual environment...
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment!
        pause
        exit /b 1
    )
)

:: Activate Virtual Environment
echo [.venv] Activating virtual environment...
call .venv\Scripts\activate.bat

:: Install basic requirements
echo [.venv] Updating pip and installing FastAPI requirements...
python -m pip install --upgrade pip
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install base dependencies!
    pause
    exit /b 1
)

:: Launch browser in background after 2 seconds
echo [Loader] Launching browser to http://127.0.0.1:8000...
powershell -Command "Start-Sleep -s 2; Start-Process 'http://127.0.0.1:8000'" >nul 2>&1

:: Start server
echo.
echo ==============================================================
echo  Server is now starting. Keep this terminal open!
echo  
echo  * HƯỚNG DẪN CÀI ĐẶT LIVE VIENEU-TTS (Offline voice cloning):
echo    Để chạy giọng đọc thực tế của VieNeu-TTS, chạy lệnh sau:
echo    pip install vieneu --extra-index-url https://pnnbao97.github.io/llama-cpp-python-v0.3.16/cpu/
echo.
echo  * NẾU CÓ CARD ĐỒ HỌA NVIDIA (GPU Cuda):
echo    pip install "vieneu[gpu]"
echo ==============================================================
echo.
python main.py

pause
