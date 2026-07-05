import { useRef } from 'react'
import { Camera, ImagePlus } from 'lucide-react'
import { Button } from '@/components/ui/primitives'

type Props = {
  label: string
  onFiles: (files: File[]) => void
  disabled?: boolean
}

export function CameraCaptureInput({ label, onFiles, disabled }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  function pick(ref: React.RefObject<HTMLInputElement | null>) {
    ref.current?.click()
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length) onFiles(files)
    e.target.value = ''
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          className="h-12 w-full text-sm"
          disabled={disabled}
          onClick={() => pick(cameraRef)}
        >
          <Camera className="h-5 w-5" />
          Chụp ảnh
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full text-sm"
          disabled={disabled}
          onClick={() => pick(galleryRef)}
        >
          <ImagePlus className="h-5 w-5" />
          Thư viện
        </Button>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}
