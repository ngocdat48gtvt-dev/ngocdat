import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { auth } from '@/firebase/firebase'
import { clearPortalSession, WEB_USER_PORTAL } from '@/lib/portalAuth'
import { useAuth } from '@/hooks/useAuth'
import { ChangePasswordDialog } from '@/components/auth/ChangePasswordDialog'
import { Button, Card } from '@/components/ui/primitives'

export function ProfilePage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [changePassOpen, setChangePassOpen] = useState(false)

  async function logout() {
    clearPortalSession(WEB_USER_PORTAL)
    await signOut(auth)
    toast.success('Đã đăng xuất')
    navigate('/login')
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Hồ sơ cá nhân</h2>

      <Card className="space-y-2 p-4 text-sm">
        <p><strong>Email:</strong> {user?.email}</p>
        <p><strong>Tên:</strong> {profile?.displayName || '—'}</p>
        <p><strong>Công ty:</strong> {profile?.companyName || '—'}</p>
        <p><strong>Vai trò:</strong> Hạt trưởng (USER)</p>
        {profile?.expireDate ? (
          <p><strong>Hạn license:</strong> {profile.expireDate}</p>
        ) : null}
      </Card>

      <Button variant="outline" className="h-12 w-full" onClick={() => setChangePassOpen(true)}>
        Đổi mật khẩu
      </Button>
      <Button variant="destructive" className="h-12 w-full" onClick={() => void logout()}>
        Đăng xuất
      </Button>

      <ChangePasswordDialog open={changePassOpen} onClose={() => setChangePassOpen(false)} />
    </div>
  )
}
