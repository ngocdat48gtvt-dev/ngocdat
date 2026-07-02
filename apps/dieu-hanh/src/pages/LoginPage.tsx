import { useState } from 'react'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { auth } from '@/firebase/firebase'
import { ForgotPasswordDialog } from '@/components/auth/ForgotPasswordDialog'
import { PortalHomeLink } from '@/components/layout/PortalHomeLink'
import {
  DIEU_HANH_PORTAL,
  getPortalRememberedEmail,
  markPortalLogin,
} from '@/lib/portalAuth'
import { loadCompanyProfile } from '@/services/authService'
import { USER_WEB_DENIED } from '@/hooks/useAuth'
import { Button, Card, Input, Label } from '@/components/ui/primitives'

type Form = { email: string; password: string }

export function LoginPage() {
  const navigate = useNavigate()
  const [forgotOpen, setForgotOpen] = useState(false)
  const { register, handleSubmit, watch, formState: { isSubmitting } } = useForm<Form>({
    defaultValues: { email: getPortalRememberedEmail(DIEU_HANH_PORTAL), password: '' },
  })
  const emailValue = watch('email')

  async function onSubmit(data: Form) {
    try {
      const cred = await signInWithEmailAndPassword(auth, data.email, data.password)
      const profile = await loadCompanyProfile(cred.user.uid)
      if (!profile) {
        await signOut(auth)
        toast.error(
          'Tài khoản chưa được gán công ty (companyId) hoặc chưa kích hoạt (active). Liên hệ quản trị.',
        )
        return
      }
      if (profile.role !== 'ADMIN') {
        await signOut(auth)
        toast.error(USER_WEB_DENIED)
        return
      }
      markPortalLogin(DIEU_HANH_PORTAL, data.email)
      toast.success(`Xin chào — ${profile.companyName}`)
      navigate('/')
    } catch {
      toast.error('Email hoặc mật khẩu không đúng')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-xl font-bold">Điều hành sự cố đường bộ</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chỉ tài khoản <strong>ADMIN</strong> (lãnh đạo công ty) đăng nhập được.
          Phiên đăng nhập tách riêng với cổng hiện trường (USER).
        </p>
        <div className="mt-3 flex justify-center">
          <PortalHomeLink />
        </div>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <Label htmlFor="dieu-hanh-login-email">Email</Label>
            <Input
              id="dieu-hanh-login-email"
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
          <Button type="submit" className="w-full" disabled={isSubmitting}>
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
