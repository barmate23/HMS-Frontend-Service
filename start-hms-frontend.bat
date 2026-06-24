@echo off
cd /d "%~dp0"
call npx.cmd ng serve --proxy-config proxy.conf.json --host 0.0.0.0 --port 4200 --no-open
pause
