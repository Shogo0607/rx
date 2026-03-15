import { Loader2 } from 'lucide-react'
import { useT } from '../../i18n'

interface LoadingStateProps {
  message?: string
}

export function LoadingState({ message }: LoadingStateProps) {
  const t = useT()
  const displayMessage = message ?? t('loading.default')
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{displayMessage}</p>
      </div>
    </div>
  )
}
