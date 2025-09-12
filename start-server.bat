@echo off
echo Starting the Revengers Esports server...

REM Navigate to the backend directory
cd backend

REM Install dependencies (if not already installed)
echo Installing dependencies...
call npm install

REM Start the server on port 3000
echo Starting server on port 3000...
call npm start
