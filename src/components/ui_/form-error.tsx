import { AlertCircle } from "lucide-react"

interface FormErrorProps {
  message: string
}

export function FormError({ message }: FormErrorProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-red-600">
      <AlertCircle className="h-4 w-4" />
      <span>{message}</span>
    </div>
  )
}
