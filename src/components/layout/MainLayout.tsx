import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { StatusBar } from './StatusBar'
import { SettingsDialog } from './SettingsDialog'
import { AiChatPanel } from '../chat/AiChatPanel'
import { ErrorBoundary } from '../ErrorBoundary'
import { useUiStore } from '../../stores/ui-store'
import { useSkillStore } from '../../stores/skill-store'
import { useProjectStore } from '../../stores/project-store'
import { useT } from '../../i18n'

export function MainLayout() {
  const activeSkillId = useUiStore((s) => s.activeSkillId)
  const chatPanelOpen = useUiStore((s) => s.chatPanelOpen)
  const getSkill = useSkillStore((s) => s.getSkill)
  const currentProjectId = useProjectStore((s) => s.currentProjectId)
  const t = useT()

  const activeSkill = getSkill(activeSkillId)
  const SkillComponent = activeSkill?.component

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Header */}
      <Header />

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Skill tabs */}
        <Sidebar />

        {/* Skill content */}
        <main className="flex-1 overflow-hidden">
          <ErrorBoundary key={activeSkillId}>
            {SkillComponent ? (
              <SkillComponent projectId={currentProjectId} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                {t('mainLayout.selectSkill')}
              </div>
            )}
          </ErrorBoundary>
        </main>

        {/* AI Chat Panel */}
        {chatPanelOpen && <AiChatPanel />}
      </div>

      {/* Status bar */}
      <StatusBar />

      {/* Settings dialog */}
      <SettingsDialog />
    </div>
  )
}
