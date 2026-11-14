import './App.css'
import Home from './pages/Home/Home'
import { Routes, Route, BrowserRouter } from "react-router-dom";
import MyField from './pages/myField/myField';

function App() {

  return (
    <div>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/myField" element={<MyField />} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}

export default App
