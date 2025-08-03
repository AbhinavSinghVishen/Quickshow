import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Home from './pages/Home.jsx'
import Movies from './pages/Movies.jsx'
import MovieDetails from './pages/MovieDetails.jsx'
import SeatLayout from './pages/SeatLayout.jsx'
import MyBookings from './pages/MyBookings.jsx'
import Favourite from './pages/Favourite.jsx'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { ClerkProvider, SignIn } from '@clerk/clerk-react'
import Layout from './pages/admin/Layout.jsx'
import Dashboard from './pages/admin/Dashboard.jsx'
import AddShows from './pages/admin/AddShows.jsx'
import ListShows from './pages/admin/ListShows.jsx'
import ListBookings from './pages/admin/ListBookings.jsx'
import { AppProvider, useAppContext } from './context/AppContext.jsx'
import Loading from './components/Loading.jsx'
import AdminAuthGaurd from './components/admin/AdminAuthGaurd.jsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Publishable Key')
}

function Root() {
  return (
    <AppProvider>
      <App />
    </AppProvider>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    children: [
      {
        path: '/',
        element: <Home />
      },
      {
        path: '/movies',
        element: <Movies />
      },
      {
        path: '/movies/:id',
        element: <MovieDetails />
      },
      {
        path: '/movies/:id/:date',
        element: <SeatLayout />
      },
      {
        path: '/my-bookings',
        element: <MyBookings />
      },
      {
        path: '/loading/:nextUrl',
        element: <Loading />
      },
      {
        path: '/favourite',
        element: <Favourite />
      },
      {
        path: '/admin/*', //now because of this wild card any route containing admin will show layout even if that path is not defined 
        element: <AdminAuthGaurd />,
        children: [
          {
            // path: '/',
            index: true,
            element: <Dashboard />
          },
          {
            path: 'add-shows',
            element: <AddShows />
          },
          {
            path: 'list-shows',
            element: <ListShows />
          },
          {
            path: 'list-bookings',
            element: <ListBookings />
          },
        ]
      },
    ]
  },
])

createRoot(document.getElementById('root')).render(
  <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
    <RouterProvider router={router} />
  </ClerkProvider>
)
