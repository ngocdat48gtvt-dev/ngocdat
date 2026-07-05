import { useState } from 'react'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { auth } from '@/firebase/firebase'
import { ForgotPasswordDialog } from '@/components/auth/ForgotPasswordDialog'
import {
  getPortalRememberedEmail,
  markPortalLogin,
  WEB_USER_PORTAL,
} from '@/lib/portalAuth'
import { loadUserProfile } from '@/services/authService'
import { ADMIN_WEB_DENIED } from '@/hooks/useAuth'
import { Button, Card, Input, Label } from '@/components/ui/primitives'

type Form = { email: string; password: string }

export function LoginPage() {
  const navigate = useNavigate()
  const [forgotOpen, setForgotOpen] = useState(false)
  const { register, handleSubmit, watch, formState: { isSubmitting } } = useForm<Form>({
    defaultValues: { email: getPortalRememberedEmail(WEB_USER_PORTAL), password: '' },
  })
  const emailValue = watch('email')

  async function onSubmit(data: Form) {
    try {
      const cred = await signInWithEmailAndPassword(auth, data.email, data.password)
      const profile = await loadUserProfile(cred.user.uid, cred.user.email)
      if (!profile) {
        await signOut(auth)
        toast.error('Tài khoản chưa kích hoạt (active) hoặc đã hết hạn license.')
        return
      }
      if (profile.role === 'ADMIN') {
        await signOut(auth)
        toast.error(ADMIN_WEB_DENIED)
        return
      }
      markPortalLogin(WEB_USER_PORTAL, data.email)
      toast.success(`Xin chào — ${profile.displayName || profile.email}`)
      navigate('/')
    } catch {
      toast.error('Email hoặc mật khẩu không đúng')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-xl font-bold text-primary">Quản lý sự cố đường bộ</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Web hiện trường — dùng tài khoản USER (hạt trưởng).
          Phiên đăng nhập tách riêng với cổng điều hành (ADMIN).
        </p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <Label htmlFor="web-user-login-email">Email</Label>
            <Input
              id="web-user-login-email"
              type="email"
              autoComplete="username"
              {...register('email', { required: true })}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => setForgotOpen(true)}
              >
                Quên mật khẩu?
              </button>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password', { required: true })}
            />
          </div>
          <Button type="submit" className="h-12 w-full text-base" disabled={isSubmitting}>
            {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Button>
        </form>
        <ForgotPasswordDialog
          open={forgotOpen}
          onClose={() => setForgotOpen(false)}
          defaultEmail={emailValue}
        />
      </Card>
    </div>
  )
}
