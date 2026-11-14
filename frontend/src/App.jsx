import './App.css'
import Home from './pages/Home/Home'
import { Routes, Route, BrowserRouter } from "react-router-dom";
import MyField from './pages/myField/myField';
import MyGear from './pages/myGear/myGear';

function App() {

  return (
    <div>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/myField" element={<MyField />} />
          <Route path="/myGear" element={<MyGear />} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}

export default App
