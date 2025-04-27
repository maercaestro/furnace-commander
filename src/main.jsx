import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import Leaderboard from './components/Leaderboard'
import AIControlDemo from './components/AIControlDemo'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/ai-demo" element={<AIControlDemo />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
