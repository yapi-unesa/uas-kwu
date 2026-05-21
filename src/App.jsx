import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Shop from './Shop';
import Admin from './Admin';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Shop />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
