import './App.css'
import Home from './pages/Home/Home'
import { Routes, Route, BrowserRouter } from "react-router-dom";
import MyField from './pages/myField/myField';
import MyGear from './pages/myGear/myGear';
import Settings from './pages/Settings/Settings';
import MyArea from './pages/myArea/myArea';
import TipKnowledge from './pages/TipKnowledge/TipKnowledge';
import { useState } from 'react';
import Login from './pages/login/login';

function App() {
  const [waterStationId, setWaterStationId] = useState(() => {
    try {
      const saved = localStorage.getItem('croptips-field-water-station')
      return /^USGS-\d{8,15}$/.test(saved || '') ? saved : null
    } catch { return null }
  })

  function saveWaterStation(id) {
    localStorage.setItem('croptips-field-water-station', id)
    setWaterStationId(id)
  }

  return (
    <div>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/myField" element={<MyField waterStationId={waterStationId} onWaterStationSave={saveWaterStation} />} />
          <Route path="/myGear" element={<MyGear />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/knowledge" element={<TipKnowledge />} />
          <Route path="/login" element={<Login />} />
          <Route path="/myArea" element={<MyArea />} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}

export default App
