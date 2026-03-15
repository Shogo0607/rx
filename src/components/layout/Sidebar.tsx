import { useSkillStore } from '../../stores/skill-store'
import { useUiStore } from '../../stores/ui-store'
import { useT } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { cn } from '../../lib/utils'
import {
  LayoutDashboard,
  BookOpen,
  HelpCircle,
  Lightbulb,
  FlaskConical,
  BarChart3,
  Sparkles,
  Workflow,
  FileText,
  Scale,
  ClipboardList,
  Calendar,
  GitBranch,
  Network,
  Wrench,
  type LucideIcon
} from 'lucide-react'

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  BookOpen,
  HelpCircle,
  Lightbulb,
  FlaskConical,
  BarChart3,
  Sparkles,
  Workflow,
  FileText,
  Scale,
  ClipboardList,
  Calendar,
  GitBranch,
  Network,
  Wrench
}

export function Sidebar() {
  const getAllSkills = useSkillStore((s) => s.getAllSkills)
  const activeSkillId = useUiStore((s) => s.activeSkillId)
  const setActiveSkill = useUiStore((s) => s.setActiveSkill)
  const skills = getAllSkills()
  const t = useT()

  return (
    <aside className="flex flex-col items-center w-14 bg-sidebar border-r border-border py-2 gap-1 overflow-y-auto">
      {skills.map((skill) => {
        const Icon = iconMap[skill.icon] ?? LayoutDashboard
        const isActive = skill.id === activeSkillId

        return (
          <button
            key={skill.id}
            onClick={() => setActiveSkill(skill.id)}
            className={cn(
              'flex items-center justify-center w-10 h-10 rounded-lg transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              'group relative',
              isActive && 'bg-accent text-sidebar-active'
            )}
            title={skill.nameKey ? t(skill.nameKey as TranslationKey) : skill.name}
          >
            <Icon className="w-5 h-5" />
            {/* Tooltip */}
            <span className="absolute left-full ml-2 px-2 py-1.5 rounded bg-popover text-popover-foreground text-xs opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-md border border-border max-w-[220px]">
              <span className="font-medium whitespace-nowrap block">
                {skill.nameKey ? t(skill.nameKey as TranslationKey) : skill.name}
              </span>
              {skill.descriptionKey && (
                <span className="text-muted-foreground text-[11px] block mt-0.5 whitespace-normal leading-tight">
                  {t(skill.descriptionKey as TranslationKey)}
                </span>
              )}
            </span>
            {/* Active indicator */}
            {isActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-sidebar-active rounded-r" />
            )}
          </button>
        )
      })}
    </aside>
  )
}
