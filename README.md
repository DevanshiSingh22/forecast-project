# Wind Power Forecast Monitor

A full-stack web application that visualises UK national wind power 
generation forecasts against actual generation data for January 2024.
The app features a live weather scene that reacts to actual wind intensity.

## Live App
https://forecast-project-seven.vercel.app/

## Files and Directories
```
forecast-project/
├── frontend/                  # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx            # Main app component — chart, controls, weather scene
│   │   ├── App.css            # All styling and animations
│   │   └── main.jsx           # Entry point
│   ├── public/
│   │   └── windy.png          # Favicon
│   ├── index.html             # HTML template
│   └── package.json           
├── backend/                   # Node.js + Express API server
│   ├── server.js              # All API routes — fetches from Elexon BMRS
│   └── package.json           
└── analysis/
    └── wind_analysis.ipynb    # Jupyter notebook — forecast error analysis
                               # and wind reliability recommendation
```

## How to Start the Application

### Backend
```bash
cd backend
npm install
node server.js
```
Server runs on http://localhost:5000

### Frontend
```bash
cd frontend
npm install
npm run dev
```
App runs on http://localhost:5173

> Note: Start the backend before the frontend.

## AI Tools Used
Used AI assistance for debugging API integration, implementing CSS 
animations, and fixing forecast horizon filter logic. Core data 
analysis, design direction, and conclusions were my own.

## Tech Stack
- Frontend: React, Vite, Recharts
- Backend: Node.js, Express, Axios
- Data: Elexon BMRS API
- Analysis: Python, Pandas, Matplotlib, Seaborn
