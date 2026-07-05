import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/dialog'
import { Button, Input, Label } from '@/components/ui/primitives'
import { useAuth } from '@/hooks/useAuth'
import { authErrorMessage, changeUserPassword } from '@/services/passwordService'

type Form = { currentPassword: string; newPassword: string; confirmPassword: string }

type Props = {
  open: boolean
  onClose: () => void
}

export function ChangePasswordDialog({ open, onClose }: Props) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const { register, handleSubmit, reset } = useForm<Form>()

  function handleClose() {
    reset()
    onClose()
  }

  async function onSubmit(data: Form) {
    if (!user) {
      toast.error('Chưa đăng nhập')
      return
    }
    if (data.newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự')
      return
    }
    if (data.newPassword !== data.confirmPassword) {
      toast.error('Mật khẩu mới và xác nhận không khớp')
      return
    }
    setSubmitting(true)
    try {
      await changeUserPassword(user, data.currentPassword, data.newPassword)
      toast.success('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.')
      handleClose()
      navigate('/login')
    } catch (err) {
      toast.error(authErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Đổi mật khẩu">
      <p className="mb-4 text-sm text-muted-foreground">
        Tài khoản: <strong>{user?.email ?? '—'}</strong>
      </p>
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <Label htmlFor="current-password">Mật khẩu hiện tại</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            {...register('currentPassword', { required: true })}
          />
        </div>
        <div>
          <Label htmlFor="new-password">Mật khẩu mới</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            {...register('newPassword', { required: true, minLength: 6 })}
          />
        </div>
        <div>
          <Label htmlFor="confirm-password">Xác nhận mật khẩu mới</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            {...register('confirmPassword', { required: true })}
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Hủy
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Đang lưu...' : 'Đổi mật khẩu'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
