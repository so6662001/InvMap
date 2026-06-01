@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   InvMap 提货导航原型 - 本地启动 (Windows)
echo ============================================
echo.

where node >nul 2>nul
if %errorlevel%==0 (
  echo 检测到 Node.js，使用 node serve.js 启动...
  node serve.js 8123
  goto :eof
)

where py >nul 2>nul
if %errorlevel%==0 (
  echo 检测到 Python (py)，启动中... 请手动打开 http://localhost:8123/
  start "" http://localhost:8123/
  py -m http.server 8123
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  echo 检测到 Python，启动中... 请手动打开 http://localhost:8123/
  start "" http://localhost:8123/
  python -m http.server 8123
  goto :eof
)

echo.
echo [!] 未检测到 Node.js 或 Python。
echo     请任选其一安装后重试：
echo       - Node.js:  https://nodejs.org/  （安装后双击本文件即可）
echo       - Python :  https://www.python.org/downloads/  （安装时勾选 Add to PATH）
echo.
pause
