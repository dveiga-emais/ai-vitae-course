# Implementación: Gestor de Tareas ICE

Guía paso a paso para implementar el MVP. Todo el código fuente se crea dentro de la carpeta `app/`. Este documento traduce la arquitectura (v2) y el planning en instrucciones concretas y ejecutables.

---

## T01 — Scaffolding del proyecto

### 1.1 Crear proyecto Vite

```bash
npm create vite@latest app -- --template react-ts
cd app
npm install
```

### 1.2 Instalar Tailwind CSS v4

Tailwind CSS v4 usa el nuevo sistema de configuración basado en CSS (sin `tailwind.config.js` ni `postcss.config.js`).

```bash
npm install tailwindcss @tailwindcss/vite
```

Configurar el plugin de Vite en `app/vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
})
```

Reemplazar el contenido de `app/src/index.css` con:

```css
@import "tailwindcss";
```

### 1.3 Limpiar boilerplate

Eliminar archivos innecesarios generados por Vite:

```bash
rm app/src/App.css
rm app/src/assets/react.svg
rm app/public/vite.svg
```

Reemplazar `app/src/App.tsx` con un componente mínimo que verifique que Tailwind funciona:

```tsx
function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <h1 className="text-3xl font-bold text-blue-600">
        Gestor de Tareas ICE
      </h1>
    </div>
  )
}

export default App
```

### 1.4 Crear estructura de carpetas

```bash
mkdir -p app/src/components/ui
mkdir -p app/src/context
mkdir -p app/src/hooks
mkdir -p app/src/services
mkdir -p app/src/types
mkdir -p app/src/utils
```

Estructura resultante:

```
app/src/
├── components/
│   └── ui/
├── context/
├── hooks/
├── services/
├── types/
├── utils/
├── App.tsx
├── main.tsx
└── index.css
```

### 1.5 Verificar

```bash
cd app
npm run dev     # Debe arrancar y mostrar "Gestor de Tareas ICE" con texto azul sobre fondo gris
npm run build   # Debe completar sin errores
```

### 1.6 Adaptar Docker (opcional)

Si se quiere servir la app en desarrollo por el puerto 3333 (mapeado en `docker-compose.yml` como `3333:80`), configurar el dev server de Vite para escuchar en el puerto 80 y en todas las interfaces:

En `app/vite.config.ts`, añadir:

```ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 80,
  },
})
```

> **Nota:** esto solo es necesario si se desarrolla dentro del devcontainer Docker. Fuera del contenedor, Vite usa `localhost:5173` por defecto.

### Entregable T01

- Proyecto arrancable con Tailwind v4 funcionando.
- Estructura de carpetas vacía lista para recibir código.
- Build sin errores.

---

## T02 — Tipos TypeScript y utilidades ICE

No depende de React. Archivos puramente de tipos y funciones.

### 2.1 Tipos — `app/src/types/task.ts`

```ts
// --- Tipos de dominio ---

export type TaskStatus = 'backlog' | 'doing' | 'done'

export type IceScore = {
  impact?: number       // 0..100, entero. undefined = sin definir
  confidence?: number   // 0..100, entero. undefined = sin definir
  ease?: number         // 0..100, entero. undefined = sin definir
  score?: number        // Math.round((I+C+E)/3). undefined si falta alguno
  rationale?: string    // Justificación IA (1-2 frases)
  source?: 'manual' | 'ai'
}

export type Task = {
  id: string            // crypto.randomUUID()
  title: string
  description?: string
  status: TaskStatus
  createdAt: string     // ISO 8601
  updatedAt: string     // ISO 8601
  ice: IceScore
}

// --- Acciones del reducer ---

export type TaskAction =
  | { type: 'ADD_TASK'; payload: { title: string; description?: string } }
  | { type: 'UPDATE_TASK'; payload: { id: string; changes: Partial<Pick<Task, 'title' | 'description' | 'status'>> } }
  | { type: 'UPDATE_ICE_MANUAL'; payload: { id: string; impact?: number; confidence?: number; ease?: number } }
  | { type: 'UPDATE_ICE_AI'; payload: { id: string; impact: number; confidence: number; ease: number; rationale: string } }
  | { type: 'DELETE_TASK'; payload: { id: string } }
  | { type: 'SET_TASKS'; payload: { tasks: Task[] } }
```

**Notas de diseño:**
- `UPDATE_TASK` solo permite cambiar `title`, `description` y `status`. Los campos ICE se mutan exclusivamente con `UPDATE_ICE_MANUAL` y `UPDATE_ICE_AI`.
- `UPDATE_ICE_MANUAL` recibe valores opcionales (el usuario puede rellenar solo algunos). Si los tres están presentes, se calcula `score`. Se pone `source: 'manual'` y se borra `rationale`.
- `UPDATE_ICE_AI` recibe los tres valores obligatorios (la IA siempre devuelve los tres). Se calcula `score`, se pone `source: 'ai'` y se guarda `rationale`.

### 2.2 Utilidades ICE — `app/src/utils/ice.ts`

```ts
/**
 * Clampea un valor numérico al rango [0, 100] y lo redondea a entero.
 */
export function clampIce(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)))
}

/**
 * Parsea, redondea y clampea un valor recibido de un formulario o de la IA.
 * Devuelve undefined si el valor no es un número válido o está vacío.
 */
export function sanitizeIceValue(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined
  const num = typeof raw === 'string' ? Number(raw) : raw
  if (typeof num !== 'number' || isNaN(num)) return undefined
  return clampIce(num)
}

/**
 * Calcula el ICE score como la media redondeada de Impact, Confidence y Ease.
 * Devuelve undefined si falta cualquiera de los tres valores.
 */
export function calculateIceScore(
  impact?: number,
  confidence?: number,
  ease?: number
): number | undefined {
  if (impact === undefined || confidence === undefined || ease === undefined) {
    return undefined
  }
  return Math.round((impact + confidence + ease) / 3)
}
```

### 2.3 Utilidades de tarea — `app/src/utils/task.ts`

```ts
import type { Task, IceScore } from '../types/task'

/**
 * Crea una nueva tarea con valores por defecto.
 */
export function createTask(title: string, description?: string): Task {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    title,
    description,
    status: 'backlog',
    createdAt: now,
    updatedAt: now,
    ice: {},
  }
}

/**
 * Devuelve true si la tarea tiene al menos un valor I/C/E definido.
 */
export function hasAnyIce(task: Task): boolean {
  const { impact, confidence, ease } = task.ice
  return impact !== undefined || confidence !== undefined || ease !== undefined
}

/**
 * Devuelve true si la tarea tiene los tres valores I/C/E definidos.
 */
export function hasCompleteIce(task: Task): boolean {
  const { impact, confidence, ease } = task.ice
  return impact !== undefined && confidence !== undefined && ease !== undefined
}
```

### Entregable T02

- `app/src/types/task.ts` con todos los tipos e interfaces.
- `app/src/utils/ice.ts` con funciones puras de ICE.
- `app/src/utils/task.ts` con funciones puras de tareas.
- Sin dependencias de React. Se pueden verificar con `console.log` o tests unitarios.

---

## T03 — Componentes UI base (Modal, ConfirmModal, Toast, ToastContext)

### 3.1 Modal shell — `app/src/components/ui/Modal.tsx`

Componente genérico que proporciona la mecánica común a todos los modales:
- Overlay semitransparente (`bg-black/50`).
- Panel centrado con bordes redondeados y sombra (`rounded-lg shadow-xl bg-white`).
- Cierre con tecla Escape, clic fuera del panel, o botón X.
- Renderiza con `createPortal` a `document.body`.
- Prop `maxWidth` para controlar el ancho: `'sm'` (384px), `'md'` (448px), `'lg'` (512px).

```tsx
// Props
type ModalProps = {
  isOpen: boolean
  onClose: () => void
  maxWidth?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}
```

**Implementación clave:**
- `useEffect` con listener de `keydown` para Escape. Cleanup en unmount.
- Handler de clic en el overlay: si el target es el overlay mismo (no un hijo), llamar `onClose`.
- Si `!isOpen`, retornar `null`.
- Usar `createPortal(jsx, document.body)`.

### 3.2 ConfirmModal — `app/src/components/ui/ConfirmModal.tsx`

Diálogo de confirmación genérico. Compone `<Modal maxWidth="sm">`.

```tsx
type ConfirmModalProps = {
  isOpen: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string       // default: "Cancelar"
  variant: 'primary' | 'destructive'
  onConfirm: () => void
  onCancel: () => void
}
```

**Estilos del botón confirmar:**
- `primary`: `bg-blue-600 hover:bg-blue-700 text-white`
- `destructive`: `bg-red-600 hover:bg-red-700 text-white`

### 3.3 Toast — `app/src/components/ui/Toast.tsx`

Componente de notificación individual.

```tsx
type ToastProps = {
  message: string
  type: 'success' | 'error'
  onClose: () => void
}
```

**Comportamiento:**
- Auto-dismiss: `useEffect` con `setTimeout` — 3000ms para `success`, 5000ms para `error`.
- Guardar el timer en `useRef` para limpiar en unmount (evitar memory leak).
- Botón X para cerrar manualmente.
- Posición: la posición `fixed` la controla el contexto que lo renderiza, no el componente en sí.

**Estilos:**
- `success`: `bg-green-50 text-green-800 border border-green-200`
- `error`: `bg-red-50 text-red-800 border border-red-200`

### 3.4 ToastContext — `app/src/context/ToastContext.tsx`

Contexto simplificado: un solo toast activo (`T | null`).

```tsx
type ToastData = {
  message: string
  type: 'success' | 'error'
}

type ToastContextValue = {
  toast: ToastData | null
  showToast: (message: string, type: 'success' | 'error') => void
  dismissToast: () => void
}
```

**Implementación:**
- `useState<ToastData | null>(null)`.
- `showToast`: reemplaza cualquier toast anterior inmediatamente.
- `dismissToast`: pone el estado a `null`.
- El Provider renderiza `<Toast>` en un contenedor `fixed top-4 right-4 z-50` si `toast !== null`.

### 3.5 Hook useToast — `app/src/hooks/useToast.ts`

Facade mínimo:

```ts
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}
```

> Se puede integrar la validación de contexto en el mismo archivo de `ToastContext.tsx` o separarlo. Lo importante es que los componentes llamen a `useToast()` sin importar la implementación interna.

### Entregable T03

- `Modal.tsx`, `ConfirmModal.tsx`, `Toast.tsx` en `components/ui/`.
- `ToastContext.tsx` en `context/`.
- `useToast.ts` en `hooks/`.
- Se pueden probar montando los componentes temporalmente en `App.tsx` con props hardcoded.

---

## T04 — Estado global y persistencia en localStorage

### 4.0 Adapter de persistencia (Inversión de dependencias)

Objetivo: que la persistencia se pueda cambiar (p.ej. PostgreSQL) tocando **solo un archivo en `services/`**, sin modificar React ni hooks.

**Contrato único — `app/src/services/persistence.ts`:**

```ts
import type { Task } from '../types/task'

export type PersistenceAdapter = {
  loadTasks: () => Promise<Task[]>
  saveTasks: (tasks: Task[]) => Promise<void>
  loadApiKey: () => Promise<string>
  saveApiKey: (key: string) => Promise<void>
  clearApiKey: () => Promise<void>
  subscribe?: (handler: () => void) => () => void
}

let adapter: PersistenceAdapter

export function setPersistenceAdapter(next: PersistenceAdapter) {
  adapter = next
}

export function getPersistenceAdapter(): PersistenceAdapter {
  if (!adapter) throw new Error('Persistence adapter not initialized')
  return adapter
}
```

**Adapter localStorage — `app/src/services/persistence.localStorage.ts`:**

```ts
import type { PersistenceAdapter } from './persistence'
import type { Task } from '../types/task'

const TASKS_KEY = 'tasks'
const API_KEY = 'gemini_api_key'

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export const localStorageAdapter: PersistenceAdapter = {
  async loadTasks(): Promise<Task[]> {
    return safeParse<Task[]>(localStorage.getItem(TASKS_KEY), [])
  },
  async saveTasks(tasks: Task[]): Promise<void> {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks))
  },
  async loadApiKey(): Promise<string> {
    return safeParse<string>(localStorage.getItem(API_KEY), '')
  },
  async saveApiKey(key: string): Promise<void> {
    localStorage.setItem(API_KEY, JSON.stringify(key))
  },
  async clearApiKey(): Promise<void> {
    localStorage.removeItem(API_KEY)
  },
  subscribe(handler) {
    const onStorage = (event: StorageEvent) => {
      if (event.key === TASKS_KEY || event.key === API_KEY) handler()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  },
}
```

**Inicialización (un único punto) — `app/src/main.tsx`:**

```ts
import { setPersistenceAdapter } from './services/persistence'
import { localStorageAdapter } from './services/persistence.localStorage'

setPersistenceAdapter(localStorageAdapter)
```

**Uso desde React (sin depender de localStorage):**
- `TaskContext` y `ApiKeyContext` consumen `getPersistenceAdapter()`.
- Si mañana se usa PostgreSQL, se crea `persistence.postgres.ts` y se cambia la línea `setPersistenceAdapter(...)` sin tocar React.

> Este diseño mantiene React aislado de la infraestructura y cumple la inversión de dependencias.

### 4.1 useLocalStorage — `app/src/hooks/useLocalStorage.ts`

Hook genérico para sincronizar estado con localStorage.

```ts
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void]
```

**Comportamiento:**
1. **Lectura inicial:** lazy initializer en `useState` — intenta `JSON.parse(localStorage.getItem(key))`. Si falla o no existe, usa `initialValue`.
2. **Escritura:** el setter escribe `JSON.stringify(value)` en localStorage y actualiza el estado.
3. **Errores de parsing:** si el JSON está corrupto, ignora silenciosamente y usa `initialValue`.
4. **Sincronización entre pestañas:** `useEffect` con listener del evento `storage`. Si otra pestaña modifica la misma `key`, actualiza el estado local. Filtrar por `event.key === key`.

**Detalle importante:** usar lazy initializer en `useState(() => ...)` para no leer localStorage en cada render.

### 4.2 TaskContext — `app/src/context/TaskContext.tsx`

**Estado del reducer:**

```ts
type TaskState = {
  tasks: Task[]
}
```

**Reducer — `taskReducer`:**

| Acción | Lógica |
|--------|--------|
| `ADD_TASK` | Crear tarea con `createTask(payload.title, payload.description)`. Añadir al final del array. |
| `UPDATE_TASK` | Encontrar por `id`. Merge `changes` con spread. Actualizar `updatedAt` a `new Date().toISOString()`. |
| `UPDATE_ICE_MANUAL` | Encontrar por `id`. Actualizar `ice.impact`, `ice.confidence`, `ice.ease` con los valores del payload (undefined si no se pasan). Recalcular `ice.score` con `calculateIceScore()`. Poner `ice.source = 'manual'`. Borrar `ice.rationale = undefined`. Actualizar `updatedAt`. |
| `UPDATE_ICE_AI` | Encontrar por `id`. Poner `ice = { impact, confidence, ease, score: calculateIceScore(...), rationale, source: 'ai' }`. Actualizar `updatedAt`. |
| `DELETE_TASK` | Filtrar `tasks.filter(t => t.id !== payload.id)`. |
| `SET_TASKS` | Reemplazar: `{ tasks: payload.tasks }`. |

**Provider:**
- Usa `useLocalStorage<Task[]>('tasks', [])` para obtener el estado inicial y el setter de persistencia.
- Usa `useReducer(taskReducer, initialTasks)` para el estado en memoria.
- `useEffect` que sincroniza `state.tasks → setLocalStorageTasks(state.tasks)` cada vez que cambia el estado.
- Expone `tasks` y `dispatch` vía Context.

**Nota sobre sincronización:** el `useLocalStorage` listener de `storage` actualiza el valor si otra pestaña escribe. Para reflejar eso en el reducer, el Provider debe detectar cambios externos y despachar `SET_TASKS`. Alternativa más simple: que el Provider use `useLocalStorage` solo para la lectura inicial y la escritura, sin reaccionar al evento `storage` en el reducer (aceptable para MVP, la sincronización cross-tab es nice-to-have).

### 4.3 ApiKeyContext — `app/src/context/ApiKeyContext.tsx`

Estado simple con `useState` envolviendo `useLocalStorage`.

```ts
type ApiKeyContextValue = {
  apiKey: string
  setApiKey: (key: string) => void
  clearApiKey: () => void
  hasApiKey: boolean              // derivado: apiKey.length > 0
}
```

**Provider:**
- `useLocalStorage<string>('gemini_api_key', '')` para estado + persistencia.
- `clearApiKey` = `setApiKey('')`.
- `hasApiKey` = `apiKey.length > 0` (valor derivado, no almacenado).

### 4.4 Hooks facade

**`app/src/hooks/useTasks.ts`:**

```ts
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
    updateIceAi: (id: string, ice: { impact: number; confidence: number; ease: number; rationale: string }) =>
      dispatch({ type: 'UPDATE_ICE_AI', payload: { id, ...ice } }),
    deleteTask: (id: string) =>
      dispatch({ type: 'DELETE_TASK', payload: { id } }),
    setTasks: (tasks: Task[]) =>
      dispatch({ type: 'SET_TASKS', payload: { tasks } }),
  }
}
```

**`app/src/hooks/useApiKey.ts`:**

```ts
export function useApiKey() {
  const context = useContext(ApiKeyContext)
  if (!context) throw new Error('useApiKey must be used within ApiKeyProvider')
  return context
}
```

### 4.5 Montar providers en App.tsx

Orden definido en la arquitectura (§3.7):

```tsx
// app/src/App.tsx
function App() {
  return (
    <ToastProvider>
      <ApiKeyProvider>
        <TaskProvider>
          <AppContent />
        </TaskProvider>
      </ApiKeyProvider>
    </ToastProvider>
  )
}

function AppContent() {
  const { hasApiKey } = useApiKey()
  return hasApiKey ? <MainView /> : <ApiKeySetup />
}
```

> `MainView` y `ApiKeySetup` serán placeholders vacíos hasta T05/T06.

### Entregable T04

- `useLocalStorage.ts` con lectura/escritura/sync.
- `TaskContext.tsx` con reducer completo y persistencia.
- `ApiKeyContext.tsx` con estado de API key.
- `useTasks.ts`, `useApiKey.ts` como facades.
- Providers montados en `App.tsx` en el orden correcto.
- Al recargar la página, las tareas y la API key persisten.

---

## T05 — Onboarding de API key y SettingsModal

### 5.1 ApiKeySetup — `app/src/components/ApiKeySetup.tsx`

Pantalla completa de onboarding, mostrada cuando `!hasApiKey`.

**Layout:**
- Contenedor: `min-h-screen bg-gray-100 flex items-center justify-center`.
- Card centrada: `bg-white rounded-lg shadow-xl p-8 max-w-md w-full`.
- Título: "Gestor de Tareas ICE" (`text-2xl font-bold text-center`).
- Subtítulo: "Configurar API Key de Gemini" (`text-lg text-gray-600 text-center`).
- Texto explicativo + link a `https://aistudio.google.com/apikey` con `target="_blank" rel="noopener noreferrer"`.
- Input: `type="text"`, placeholder "Pega tu API key aquí". Estilo outlined: `border border-gray-300 rounded-md px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500`.
- Botón: "Guardar y continuar". `bg-blue-600 text-white rounded-md px-4 py-2 w-full`. Disabled si input vacío (`opacity-50 cursor-not-allowed`).

**Consume:** `useApiKey` (`setApiKey`), `useToast` (`showToast`).

**Estado local:** `inputValue: string`.

**Comportamiento al guardar:**
1. `setApiKey(inputValue.trim())`.
2. `showToast('API key guardada', 'success')`.
3. El componente desaparece automáticamente porque `hasApiKey` pasa a `true` y `App` renderiza `MainView`.

### 5.2 SettingsModal — `app/src/components/SettingsModal.tsx`

Modal accesible desde el botón engranaje del Header.

**Props:** `isOpen`, `onClose`.

**Consume:** `useApiKey`, `useToast`.

**Estado local:**
- `newKeyInput: string` — inicializado con la key actual al abrir.
- `isDeleteConfirmOpen: boolean`.

**Contenido:**
- Key enmascarada: primeros 4 chars + `•••` + últimos 4 chars (si la key tiene más de 8 chars, sino mostrarla completa enmascarada).
- Input para nueva key.
- Botón "Guardar": actualiza la key, muestra toast "API key actualizada", cierra el modal.
- Botón "Eliminar key": abre un `ConfirmModal` interno con:
  - `variant: 'destructive'`
  - `title: "Eliminar API key"`
  - `message: "Si eliminas la API key tendrás que volver a introducirla. ¿Continuar?"`
  - `confirmLabel: "Eliminar"`
  - Si confirma: `clearApiKey()`, toast "API key eliminada", cierra modal. App vuelve a mostrar onboarding.

> **Nota:** `SettingsModal` contiene su propio `ConfirmModal` anidado para eliminar la key. Esto es aceptable porque es un flujo autocontenido que no se multiplica por N (a diferencia de `TaskCard`). Ver justificación en arquitectura §2.2.

### Entregable T05

- Al abrir la app sin key → pantalla de onboarding.
- Tras guardar → vista principal (placeholder).
- Al recargar → no vuelve a pedir la key.
- Desde settings (engranaje en header) → se puede cambiar o eliminar la key.
- Si se elimina → vuelve el onboarding al recargar.

---

## T06 — CRUD de tareas

### 6.1 TaskModal — `app/src/components/TaskModal.tsx`

Modal para crear o editar tareas.

**Props:**

```tsx
type TaskModalProps = {
  isOpen: boolean
  task?: Task              // si viene → edición; si no → creación
  onSave: (data: TaskFormData) => void
  onClose: () => void
}

type TaskFormData = {
  title: string
  description?: string
  status?: TaskStatus      // solo en edición
  impact?: number
  confidence?: number
  ease?: number
}
```

**Estado local:** `title`, `description`, `status`, `impact` (string), `confidence` (string), `ease` (string), `titleError: boolean`.

**Comportamiento:**
- En modo edición: pre-rellenar campos con los valores actuales de la tarea. Mostrar select de estado.
- En modo creación: campos vacíos. Ocultar select de estado (siempre `backlog`).
- Al abrir: resetear `titleError`.
- Campos ICE: inputs `type="number"` con `min=0 max=100 step=1`. Si vacíos → `undefined`. Si con valor → `sanitizeIceValue()`.
- Nota visible debajo de ICE: "Enteros de 0 a 100. Dejar vacío si no se quiere definir."

**Validación al guardar:**
1. Si `title.trim() === ''`: poner `titleError = true`, mostrar borde rojo en el input + texto "El título es obligatorio". No cerrar modal.
2. Si válido: llamar `onSave(formData)`. El padre (`MainView`) decide si despachar `ADD_TASK` + `UPDATE_ICE_MANUAL` o `UPDATE_TASK` + `UPDATE_ICE_MANUAL`.

**Detalle:** `TaskModal` no llama a `addTask` ni `updateTask` directamente. Solo empaqueta los datos y los emite. El orquestador (`MainView`) decide qué acciones despachar. Esto mantiene `TaskModal` desacoplado del contexto.

### 6.2 Eliminar tarea (en MainView)

Cuando `TaskCard` emite `onDelete(task)`:
1. `MainView` pone `modalState = { type: 'confirm-delete', task }`.
2. Se muestra `ConfirmModal` con:
   - `title: "Eliminar tarea"`
   - `message: "¿Seguro que quieres eliminar «{task.title}»? Esta acción no se puede deshacer."`
   - `variant: 'destructive'`
   - `confirmLabel: "Eliminar"`
3. Si confirma: `deleteTask(task.id)`, `modalState = { type: 'closed' }`.
4. Si cancela: `modalState = { type: 'closed' }`.

### 6.3 Cambiar estado desde tarjeta

`TaskCard` tiene un `<select>` con los tres estados. `onChange` emite `onStatusChange(task.id, newStatus)` directamente (sin confirmación).

`MainView` recibe el evento y llama a `updateTask(task.id, { status: newStatus })`.

### 6.4 Flujo completo en MainView (modalState)

Estado del orquestador (unión discriminada):

```ts
type ModalState =
  | { type: 'closed' }
  | { type: 'create-task' }
  | { type: 'edit-task'; task: Task }
  | { type: 'confirm-delete'; task: Task }
  | { type: 'confirm-estimate'; task: Task }
  | { type: 'confirm-import'; pendingTasks: Task[] }
```

En JSX de `MainView`:
- `<TaskModal isOpen={modalState.type === 'create-task' || modalState.type === 'edit-task'} ...>`
- `<ConfirmModal isOpen={modalState.type === 'confirm-delete' || modalState.type === 'confirm-estimate' || modalState.type === 'confirm-import'} ...>`
- Derivar `title`, `message`, `variant`, `confirmLabel`, `onConfirm` del `modalState.type` actual.

### Entregable T06

- Crear tareas con título obligatorio y descripción opcional.
- Editar tareas (modal pre-rellenado).
- Eliminar tareas con confirmación por modal.
- Cambiar estado desde select en la tarjeta.
- Todo persiste en localStorage.

---

## T07 — Listado, ordenación y filtros

### 7.1 IceBadge — `app/src/components/IceBadge.tsx`

**Props:** `ice: IceScore`.

**Renderizado:**
- Si `ice.score !== undefined`: número grande (`text-3xl font-bold`), etiqueta "ICE Score" debajo.
- Si `ice.score === undefined`: texto "Pendiente" en gris (`text-gray-400`).
- Desglose I/C/E en fila: tres items con label ("I:", "C:", "E:") y valor (número o "–" si `undefined`).
- Si `ice.source === 'ai'` y hay `ice.rationale`: chip "Fuente: IA" + justificación en itálica gris.
- Si `ice.source === 'manual'`: chip "Fuente: Manual".

### 7.2 TaskCard — `app/src/components/TaskCard.tsx`

**Props:** `task`, `onEdit`, `onDelete`, `onEstimate`, `onStatusChange`.

**Layout (3 zonas):**
1. **Cabecera:** título a la izquierda + `<select>` de estado a la derecha.
2. **Cuerpo:** `<IceBadge ice={task.ice} />`.
3. **Acciones:** `<AiEstimateButton>` + botón "Editar" + botón "Eliminar".

**Sin estado local. Sin modales propios. Sin importar contextos.**

**Badge de estado (colores del select o badge):**
- `backlog`: `bg-gray-100 text-gray-700`
- `doing`: `bg-blue-100 text-blue-700`
- `done`: `bg-green-100 text-green-700`

### 7.3 TaskList — `app/src/components/TaskList.tsx`

**Props:**

```tsx
type TaskListProps = {
  tasks: Task[]                                    // ya procesadas (filtradas y ordenadas)
  hasActiveFilters: boolean
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onEstimate: (task: Task) => void
  onStatusChange: (id: string, status: TaskStatus) => void
  onNewTask: () => void
  onClearFilters: () => void
}
```

**Comportamiento:**
- Mapea `tasks` a `<TaskCard>`.
- Si `tasks.length === 0`:
  - Si `hasActiveFilters`: empty state "Sin resultados" con botón "Limpiar filtros" (`onClearFilters`).
  - Si `!hasActiveFilters`: empty state "No hay tareas" con botón "Crear tu primera tarea" (`onNewTask`).

### 7.4 Toolbar — `app/src/components/Toolbar.tsx`

**Props:** componente controlado, sin estado propio.

```tsx
type ToolbarProps = {
  searchQuery: string
  onSearchChange: (query: string) => void
  statusFilter: 'all' | TaskStatus
  onStatusFilterChange: (status: 'all' | TaskStatus) => void
  sortOrder: 'ice' | 'date' | 'title'
  onSortOrderChange: (order: 'ice' | 'date' | 'title') => void
  onNewTask: () => void
}
```

**Elementos:**
- Botón "+ Nueva tarea" (`bg-blue-600 text-white`).
- Input de búsqueda (`placeholder="Buscar..."`).
- Select de estado: `Todos | Backlog | En progreso | Completadas`.
- Select de orden: `ICE (mayor primero) | Fecha (reciente primero) | Título (A-Z)`.

### 7.5 useTaskFilters — `app/src/hooks/useTaskFilters.ts`

```ts
type FilterParams = {
  searchQuery: string
  statusFilter: 'all' | TaskStatus
  sortOrder: 'ice' | 'date' | 'title'
}

type FilterResult = {
  filteredTasks: Task[]
  hasActiveFilters: boolean
}

export function useTaskFilters(tasks: Task[], filters: FilterParams): FilterResult
```

**Lógica interna (envuelta en `useMemo`):**
1. **Filtro de estado:** si `statusFilter !== 'all'`, filtrar `task.status === statusFilter`.
2. **Búsqueda de texto:** `query.toLowerCase()`. Filtrar si `title.toLowerCase().includes(query)` o `description?.toLowerCase().includes(query)`. AND lógico con el filtro de estado.
3. **Ordenación:**
   - `'ice'`: descendente por `score`. Los que no tienen score (`score ?? -1`) van al final.
   - `'date'`: descendente por `createdAt` (comparación de strings ISO = orden cronológico invertido).
   - `'title'`: ascendente con `localeCompare`.
4. **`hasActiveFilters`:** `searchQuery.trim() !== '' || statusFilter !== 'all'`.

### 7.6 Integrar en MainView

`MainView` mantiene los estados de filtro como `useState`:

```ts
const [searchQuery, setSearchQuery] = useState('')
const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all')
const [sortOrder, setSortOrder] = useState<'ice' | 'date' | 'title'>('ice')
```

Llama a `useTaskFilters(tasks, { searchQuery, statusFilter, sortOrder })` para obtener `filteredTasks` y `hasActiveFilters`.

Función `clearFilters` para el empty state:
```ts
const clearFilters = () => {
  setSearchQuery('')
  setStatusFilter('all')
}
```

### Entregable T07

- Vista principal con tarjetas estilizadas que muestran ICE, estado y acciones.
- Búsqueda por texto, filtro por estado, ordenación por ICE/fecha/título.
- Empty states diferenciados (sin tareas vs. sin resultados).
- La lista reacciona en tiempo real a cambios de filtros y datos.

---

## T08 — Integración con Google Gemini API

### 8.1 Servicio Gemini — `app/src/services/gemini.ts`

```ts
import type { IceScore } from '../types/task'
import { clampIce, calculateIceScore } from '../utils/ice'

export async function estimateIce(
  apiKey: string,
  title: string,
  description: string
): Promise<IceScore>
```

**Prompt:** el definido en la sección 8.2 del MVP spec (ver arriba).

**Endpoint:**
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}
```

**Request body:**
```json
{
  "contents": [{
    "parts": [{ "text": "<prompt con título y descripción>" }]
  }]
}
```

**Headers:** `Content-Type: application/json`.

**Parsing de la respuesta:**
1. Si `!response.ok`: leer body y lanzar `Error` con el mensaje de la API.
2. Extraer texto: `response.candidates[0].content.parts[0].text`.
3. Intentar `JSON.parse(text)`.
4. Si falla: buscar el primer `{...}` con regex (`/\{[\s\S]*\}/`) y parsear.
5. Validar que `impact`, `confidence`, `ease` sean números.
6. Sanitizar: `clampIce(Math.round(value))` para cada uno.
7. Calcular `score` con `calculateIceScore`.
8. Retornar `IceScore` con `source: 'ai'` y `rationale`.
9. Si cualquier paso falla: lanzar `Error` con mensaje descriptivo.

### 8.2 AiEstimateButton — `app/src/components/AiEstimateButton.tsx`

**Props:**

```tsx
type AiEstimateButtonProps = {
  task: Task
  disabled: boolean
  disabledReason?: string
  isLoading: boolean
  onRequestEstimate: () => void
}
```

**Componente presentacional.** No gestiona loading, no llama al servicio, no abre modales.

**Tres estados visuales:**
1. **Normal:** botón clickable "Calcular ICE con IA". Clic emite `onRequestEstimate()`.
2. **Loading:** spinner (`animate-spin` en un SVG circular) + "Calculando..." + `disabled`.
3. **Disabled:** gris + `cursor-not-allowed` + `title={disabledReason}` como tooltip nativo.

### 8.3 Lógica de IA en MainView

Cuando `TaskCard` emite `onEstimate(task)`:
1. Verificar disabled conditions y determinar `disabledReason`:
   - Si `!task.description`: "Añade una descripción para poder estimar con IA".
   - Si `!hasApiKey`: "Configura tu API key primero".
   - Si alguna condición se cumple, el botón ya está disabled y no debería llegar aquí.
2. `MainView` pone `modalState = { type: 'confirm-estimate', task }`.
3. Se muestra `ConfirmModal` con mensaje diferenciado:
   - Si `!hasAnyIce(task)`: título "Calcular ICE con IA", mensaje "¿Quieres que la IA estime el ICE para esta tarea?", `confirmLabel: "Calcular"`.
   - Si `hasAnyIce(task)`: título "Recalcular ICE con IA", mensaje "Esta tarea ya tiene valores ICE. ¿Quieres sobreescribirlos con la estimación de la IA?", `confirmLabel: "Recalcular"`.
4. Si confirma:
   - `setEstimatingTaskId(task.id)`.
   - `setModalState({ type: 'closed' })` — cerrar confirm modal.
   - `await estimateIce(apiKey, task.title, task.description!)`.
   - **Éxito:** `updateIceAi(task.id, result)`, `showToast('ICE calculado correctamente', 'success')`.
   - **Error:** `showToast('Error al calcular ICE: ' + error.message, 'error')`.
   - `setEstimatingTaskId(null)`.
5. Si cancela: `setModalState({ type: 'closed' })`.

`MainView` pasa a cada `TaskCard`:
- `onEstimate`: handler que abre el confirm modal.
- Al renderizar `AiEstimateButton` dentro de `TaskCard`, las props `disabled`, `disabledReason`, `isLoading` se derivan del estado de `MainView`. **Pero** `TaskCard` es presentacional... Hay dos opciones:

**Opción elegida (coherente con la arquitectura):** `MainView` calcula las props de cada `AiEstimateButton` antes de pasarlas a `TaskList`/`TaskCard`. Esto se puede hacer pasando las props necesarias a `TaskCard` que las reenvia:

```tsx
// En TaskCard
<AiEstimateButton
  task={task}
  disabled={!task.description || !hasApiKey}  // MainView pasa hasApiKey como prop
  disabledReason={...}
  isLoading={estimatingTaskId === task.id}     // MainView pasa estimatingTaskId
  onRequestEstimate={() => onEstimate(task)}
/>
```

Alternativa: que `TaskCard` reciba `isEstimating: boolean` y `hasApiKey: boolean` como props adicionales y derive las props de `AiEstimateButton` internamente.

### Entregable T08

- Botón "Calcular ICE con IA" funcional en cada tarjeta.
- Confirmación previa (diferenciada si ya tiene ICE o no).
- Loading state visible en el botón.
- Éxito: valores I/C/E + justificación guardados, toast.
- Error: toast de error, valores no modificados.
- Disabled si falta descripción o API key (con tooltip).

---

## T09 — Exportar / Importar JSON

### 9.1 Utilidades — `app/src/utils/exportImport.ts`

**Exportar:**

```ts
export function exportTasks(tasks: Task[]): void {
  const json = JSON.stringify(tasks, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'tareas-ice.json'
  a.click()
  URL.revokeObjectURL(url)
}
```

**Parsear archivo importado:**

```ts
export function parseImportFile(content: string): Task[] {
  const parsed = JSON.parse(content)
  if (!Array.isArray(parsed)) throw new Error('El archivo no contiene un array')
  validateTaskArray(parsed)
  return parsed
}
```

**Validar:**

```ts
export function validateTaskArray(arr: unknown[]): asserts arr is Task[] {
  for (const item of arr) {
    if (typeof item !== 'object' || item === null) throw new Error('Elemento no válido')
    if (!('id' in item) || !('title' in item)) throw new Error('Elemento sin id o title')
  }
}
```

> Validación básica: al menos `id` y `title`. No se valida el esquema completo (aceptable para MVP).

### 9.2 Botones en Header

**Exportar:**
- Botón "Exportar" en `Header`.
- Al clicar: `exportTasks(tasks)`.
- Si `tasks.length === 0`: botón deshabilitado (no hay nada que exportar).

**Importar:**
- Botón "Importar" en `Header`.
- Al clicar: trigger de un `<input type="file" accept=".json">` oculto (`display: none`), usando `useRef`.
- Al seleccionar archivo:
  1. Leer con `FileReader.readAsText()`.
  2. `parseImportFile(content)`.
  3. Si error de parsing: `showToast('Error al importar: formato de archivo no válido', 'error')`. No abrir modal.
  4. Si parseo exitoso: emitir hacia `MainView` vía prop (`onImportTasks(parsedTasks)`).

**En MainView:**
- `MainView` recibe las tareas parseadas y pone `modalState = { type: 'confirm-import', pendingTasks }`.
- `ConfirmModal`:
  - `title: "Importar tareas"`
  - `message: "Esto reemplazará todas las tareas actuales. ¿Quieres continuar?"`
  - `variant: 'primary'`
  - `confirmLabel: "Importar"`
- Si confirma: `setTasks(pendingTasks)`, `showToast('Tareas importadas correctamente', 'success')`, cerrar modal.
- Si cancela: cerrar modal.

### Entregable T09

- Botón "Exportar" descarga `tareas-ice.json`.
- Botón "Importar" abre selector de archivos.
- Al importar: confirmación → reemplaza tareas → toast éxito.
- Si archivo inválido: toast error sin reemplazar nada.

---

## T10 — Layout final, pulido visual y README

### 10.1 Header — `app/src/components/Header.tsx`

**Layout definitivo:**
- Fondo: `bg-white shadow-sm` (o `bg-blue-800 text-white` si se prefiere oscuro). Sticky: `sticky top-0 z-40`.
- Contenedor: `max-w-4xl mx-auto px-4 h-16 flex items-center justify-between`.
- Izquierda: título "Gestor de Tareas ICE" (`text-xl font-bold`).
- Derecha: botones Exportar, Importar, engranaje (icono SVG).

### 10.2 Layout App

```tsx
<div className="min-h-screen bg-gray-100">
  <Header />
  <main className="max-w-4xl mx-auto px-4 py-6">
    <Toolbar />
    <TaskList />
  </main>
</div>
```

### 10.3 Pulido visual

- Verificar hover/focus/disabled en todos los botones.
- Transiciones suaves: `transition-colors duration-150` en botones.
- Focus rings: `focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`.
- Responsive básico: en pantallas pequeñas, cards al 100% y toolbar con wrap (`flex-wrap`).
- Consistencia de spacing (padding, margins, gaps).

### 10.4 README.md

Crear `app/README.md` con:

- **Título y descripción:** Gestor de Tareas ICE — app de priorización con modelo ICE y estimación por IA.
- **Requisitos:** Node.js >= 18.
- **Instalación y ejecución:**
  ```
  cd app
  npm install
  npm run dev
  ```
- **API Key:** explicar que al abrir la app se pide la key. Link a Google AI Studio.
- **Limitaciones:** key en localStorage, sin backend, límites del free tier de Gemini.

### Entregable T10

- App visualmente coherente y terminada.
- Responsive básico.
- README listo.
- Build sin errores (`npm run build`).

---

## Resumen de dependencias

```
T01 ─→ T02 ─→ T04 ─→ T05 ─→ T08 ─→ T10
  │           ↗    ↘         ↗
  └──→ T03 ─┘      ─→ T06 ─→ T07 ─┘
                    ↘
                     → T09 ────────→ T10
```

**Camino crítico:** T01 → T02 → T04 → T06 → T07 → T08 → T10
