import './App.css'
import { Routes, Route, BrowserRouter } from 'react-router-dom'
import FAQ from './pages/FAQ/FAQ'
import Home from './pages/Home/Home'
import MyField from './pages/myField/myField'
import MyGear from './pages/myGear/myGear'
import MyArea from './pages/myArea/myArea'
import Settings from './pages/Settings/Settings'
import TipKnowledge from './pages/TipKnowledge/TipKnowledge'
import Login from './pages/Login/login'
import FieldProvider from './components/FieldProvider'
import DemoWelcome from './components/DemoWelcome'
import CropRotation from './pages/CropRotation/CropRotation'
import Onboarding from './pages/onboarding/Onboarding'

export default function App() {
  return (
    <FieldProvider><BrowserRouter><DemoWelcome />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/myField" element={<MyField />} />
        <Route path="/myGear" element={<MyGear />} />
        <Route path="/myArea" element={<MyArea />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/knowledge" element={<TipKnowledge />} />
        <Route path="/login" element={<Login />} />
        <Route path="/crop-rotation" element={<CropRotation />} />
        <Route path="/onboarding" element={<Onboarding />} />
      </Routes>
    </BrowserRouter></FieldProvider>
  )
}
