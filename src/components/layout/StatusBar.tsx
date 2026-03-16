import { useUiStore } from '../../stores/ui-store'
import { useSkillStore } from '../../stores/skill-store'
import { useProjectStore } from '../../stores/project-store'
import { useChatStore } from '../../stores/chat-store'
import { useT } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { Circle } from 'lucide-react'

export function StatusBar() {
  const activeSkillId = useUiStore((s) => s.activeSkillId)
  const getSkill = useSkillStore((s) => s.getSkill)
  const getCurrentProject = useProjectStore((s) => s.getCurrentProject)
  const defaultModel = useUiStore((s) => s.defaultModel)
  const llmLoading = useChatStore((s) => s.loading)
  const activeAgent = useChatStore((s) => s.activeAgent)

  const t = useT()
  const activeSkill = getSkill(activeSkillId)
  const currentProject = getCurrentProject()
  const skillName = activeSkill?.nameKey ? t(activeSkill.nameKey as TranslationKey) : activeSkill?.name ?? 'Dashboard'

  return (
    <footer className="flex items-center h-6 px-3 text-[11px] text-muted-foreground border-t border-border bg-sidebar select-none">
      {/* Project info */}
      <span>{currentProject?.name ?? t('common.noProject')}</span>

      <span className="mx-2 text-border">|</span>

      {/* Active skill */}
      <span>{skillName}</span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Active agent */}
      {activeAgent && (
        <>
          <span className="mr-2">{t('statusBar.agent')} {activeAgent}</span>
          <span className="mx-2 text-border">|</span>
        </>
      )}

      {/* LLM status */}
      <div className="flex items-center gap-1.5">
        <span>{defaultModel}</span>
        <Circle
          className={`w-2 h-2 ${
            llmLoading
              ? 'fill-yellow-500 text-yellow-500 animate-pulse'
              : 'fill-green-500 text-green-500'
          }`}
        />
        <span>{llmLoading ? t('statusBar.processing') : t('statusBar.ready')}</span>
      </div>
    </footer>
  )
}
