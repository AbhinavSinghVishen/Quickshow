import React from 'react'
import { useAppContext } from '../../context/AppContext'
import Loading from '../Loading'
import Layout from '../../pages/admin/Layout'
import { SignIn } from '@clerk/clerk-react'

const AdminAuthGaurd = () => {
    const {user, checked, isAdmin} = useAppContext()

    if(!checked){
        return <Loading/>
    }

    //if check is done and we have a user who is not an admin then fetchIsAdmin() in useAppContext() start navigation
    //but till the whole page changes user will get a flash of singIn page to prevent this we will show loading page.
    if(user && !isAdmin){
        return <Loading/>
    }

    if(user && isAdmin){
        return <Layout/>
    }
  return (
     <div className='min-h-screen flex justify-center items-center'>
      <SignIn fallbackRedirectUrl={'/admin'} />
    </div>
  )
}

export default AdminAuthGaurd
