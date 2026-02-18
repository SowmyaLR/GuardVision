@echo off
REM GuardVision Setup Verification Script for Windows

echo ============================================================
echo GuardVision Setup Validation
echo ============================================================
echo.

echo Checking if .env file exists...
if exist .env (
    echo [OK] .env file found
) else (
    echo [ERROR] .env file not found
    echo Please run: copy .env.example .env
    echo Then add your GEMINI_API_KEY to the .env file
    exit /b 1
)
echo.

echo Checking if Docker is running...
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running
    echo Please start Docker Desktop and try again
    exit /b 1
)
echo [OK] Docker is running
echo.

echo Checking services (this may take a moment)...
timeout /t 3 /nobreak >nul

echo Checking Backend API...
curl.exe -f -s http://localhost:9000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Backend API is running
) else (
    echo [WARN] Backend API not responding yet
    echo This is normal if services just started. Wait 30-60s and try again.
)

echo Checking Frontend...
curl.exe -f -s http://localhost:3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Frontend is running
) else (
    echo [WARN] Frontend not responding yet
    echo This is normal if services just started. Wait 30-60s and try again.
)

echo.
echo ============================================================
echo Next Steps:
echo   - Frontend:  http://localhost:3000
echo   - Backend:   http://localhost:9000
echo   - API Docs:  http://localhost:9000/docs
echo.
echo To view logs: docker compose logs
echo To restart:   docker compose restart
echo ============================================================
