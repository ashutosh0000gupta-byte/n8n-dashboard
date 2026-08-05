@echo off
echo Pushing updates to GitHub...
git add .
git commit -m "Complete S5 Nutrition dashboard redesign and chat modal"
git push
echo.
echo Done! Press any key to exit.
pause >nul
