import { Outlet } from 'react-router-dom'
import { DispatchProvider } from '@/context/DispatchContext'

export function DispatchLayout() {
  return (
    <DispatchProvider>
      <Outlet />
    </DispatchProvider>
  )
}
