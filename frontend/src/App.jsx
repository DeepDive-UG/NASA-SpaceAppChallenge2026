import './App.css'
import Home from './pages/Home/Home'
import { Routes, Route, BrowserRouter } from "react-router-dom";
import MyField from './pages/myField/myField';
import MyGear from './pages/myGear/myGear';
import MyArea from './pages/myArea/myArea';
import FieldProvider from './components/FieldProvider';
import Settings from './pages/settings/Settings';
import CropRotation from './pages/CropRotation';

function App() {
  return (
    <div>
      <FieldProvider><BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/myField" element={<MyField />} />
          <Route path="/myGear" element={<MyGear />} />
          <Route path="/myArea" element={<MyArea />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/crop-rotation" element={<CropRotation />} />
        </Routes>
      </BrowserRouter></FieldProvider>
    </div>
  )
}

export default App
