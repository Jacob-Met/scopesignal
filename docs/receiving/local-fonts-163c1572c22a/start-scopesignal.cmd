@echo off
setlocal
pushd "%~dp0app" || exit /b 1
node scripts\serve.mjs
set "SCOPESIGNAL_EXIT=%ERRORLEVEL%"
popd
if not "%SCOPESIGNAL_EXIT%"=="0" pause
exit /b %SCOPESIGNAL_EXIT%
