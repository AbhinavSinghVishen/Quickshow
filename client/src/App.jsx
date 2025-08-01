import React from 'react'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import { Outlet, useLocation } from 'react-router'
import { Toaster } from 'react-hot-toast'

const App = () => {

  const isAdminRoute = useLocation().pathname.startsWith('/admin')

  return (
    <div>
      <Toaster/>
      {!isAdminRoute && <Navbar/>}
      <Outlet/>
      {!isAdminRoute && <Footer/>}
    </div>
  )
}

export default App
