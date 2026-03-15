export interface Project {
  id: string
  name: string
  description: string | null
  status: 'active' | 'archived' | 'completed'
  createdAt: string
  updatedAt: string
}

export interface CreateProjectInput {
  name: string
  description?: string
}

export interface UpdateProjectInput {
  id: string
  name?: string
  description?: string
  status?: Project['status']
}
