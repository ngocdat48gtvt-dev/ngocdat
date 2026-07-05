import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/dialog'
import { Button, Input, Label } from '@/components/ui/primitives'
import { authErrorMessage, sendPasswordReset } from '@/services/passwordService'

type Form = { email: string }

type Props = {
  open: boolean
  onClose: () => void
  defaultEmail?: string
}

export function ForgotPasswordDialog({ open, onClose, defaultEmail }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<Form>({ defaultValues: { email: defaultEmail ?? '' } })

  useEffect(() => {
    if (open) reset({ email: defaultEmail ?? '' })
  }, [open, defaultEmail, reset])

  async function onSubmit(data: Form) {
    const email = data.email.trim()
    if (!email) {
      toast.error('Nhập email đăng nhập')
      return
    }
    try {
      await sendPasswordReset(email)
      toast.success('Đã gửi link đặt lại mật khẩu vào email. Kiểm tra hộp thư (và thư rác).')
      onClose()
    } catch (err) {
      toast.error(authErrorMessage(err))
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Quên mật khẩu">
      <p className="mb-4 text-sm text-muted-foreground">
        Nhập email tài khoản ADMIN. Firebase sẽ gửi link đặt lại mật khẩu qua email.
      </p>
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <Label htmlFor="forgot-email">Email</Label>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="username"
            {...register('email', { required: true })}
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Đang gửi...' : 'Gửi link reset'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
