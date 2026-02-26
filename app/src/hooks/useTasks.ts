import { useContext } from 'react'
import type { Task } from '@/types/task'
import { TaskContext } from '@/context/TaskContext'

export function useTasks() {
  const context = useContext(TaskContext)
  if (!context) throw new Error('useTasks must be used within TaskProvider')
  const { tasks, dispatch } = context

  return {
    tasks,
    addTask: (title: string, description?: string) =>
      dispatch({ type: 'ADD_TASK', payload: { title, description } }),
    updateTask: (id: string, changes: Partial<Pick<Task, 'title' | 'description' | 'status'>>) =>
      dispatch({ type: 'UPDATE_TASK', payload: { id, changes } }),
    updateIceManual: (id: string, ice: { impact?: number; confidence?: number; ease?: number }) =>
      dispatch({ type: 'UPDATE_ICE_MANUAL', payload: { id, ...ice } }),
    updateIceAi: (
      id: string,
      ice: { impact: number; confidence: number; ease: number; rationale: string },
    ) => dispatch({ type: 'UPDATE_ICE_AI', payload: { id, ...ice } }),
    deleteTask: (id: string) => dispatch({ type: 'DELETE_TASK', payload: { id } }),
    setTasks: (tasks: Task[]) => dispatch({ type: 'SET_TASKS', payload: { tasks } }),
  }
}
