import { useEffect } from 'react'
import { MainLayout } from './components/layout/MainLayout'
import { CommandPalette } from './components/layout/CommandPalette'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/ui/Toaster'
import { useProjectStore } from './stores/project-store'
import { useSkillStore } from './stores/skill-store'
import { useUiStore } from './stores/ui-store'
import { builtinSkills } from './skills'

export function App() {
  const loadProjects = useProjectStore((s) => s.loadProjects)
  const registerSkills = useSkillStore((s) => s.registerSkills)
  const toggleCommandPalette = useUiStore((s) => s.toggleCommandPalette)

  useEffect(() => {
    registerSkills(builtinSkills)
    loadProjects()
  }, [registerSkills, loadProjects])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        toggleCommandPalette()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleCommandPalette])

  return (
    <ErrorBoundary>
      <ToastProvider>
        <MainLayout />
        <CommandPalette />
      </ToastProvider>
    </ErrorBoundary>
  )
}
