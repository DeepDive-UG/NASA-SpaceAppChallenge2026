import './App.css'
import Home from './pages/Home/Home'
import { Routes, Route, BrowserRouter } from "react-router-dom";
import MyField from './pages/myField/myField';
import MyGear from './pages/myGear/myGear';
import MyArea from './pages/myArea/myArea';

function App() {

  return (
    <div>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/myField" element={<MyField />} />
          <Route path="/myGear" element={<MyGear />} />
          <Route path="/myArea" element={<MyArea />} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}

export default App
