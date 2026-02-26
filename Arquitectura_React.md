# Arquitectura React: Gestor de Tareas ICE (v2)

Propuesta de arquitectura basada en los flujos definidos en `design/`, el MVP spec, el análisis de ambigüedades, y las correcciones derivadas de la revisión crítica de la v1.

### Correcciones aplicadas respecto a la v1

| # | Problema detectado en v1 | Corrección aplicada |
|---|--------------------------|---------------------|
| 1 | **God Component en MainView.** Acumulaba filtros, modales, lógica de filtrado y renderizado. | Extraído hook `useTaskFilters` para la lógica de filtrado/ordenación. `MainView` solo orquesta y renderiza. |
| 2 | **TaskCard acoplada y con modales internos.** Cada tarjeta instanciaba sus propios `ConfirmModal`, multiplicando lógica por N tareas. | `TaskCard` pasa a ser presentacional. Solo emite eventos (`onEdit`, `onDelete`, `onEstimate`). Los modales se centralizan: una única instancia de `ConfirmModal` y `TaskModal` en `MainView`. |
| 3 | **Race conditions en useLocalStorage.** Sin sincronización entre pestañas. | Se añade listener del evento `storage` en `useLocalStorage` para sincronizar pestañas. |
| 4 | **Complejidad innecesaria en ToastContext (cola FIFO).** Implementar cola de toasts con ids, timers y cleanup es overengineering para un MVP. | Simplificado a **un solo toast activo** (`currentToast \| null`). Si llega uno nuevo, reemplaza al anterior. |
| 5 | **Lógica de negocio dispersa.** El recálculo de ICE estaba fragmentado entre el reducer (edición manual), `AiEstimateButton` (estimación IA) y utils. | Centralizada en el reducer con acciones específicas: `UPDATE_ICE_MANUAL` y `UPDATE_ICE_AI`. El reducer es el único punto donde se mutan datos de una tarea. |

---

## 1. Estructura de carpetas

```
src/
│
├── components/               # Componentes React (.tsx)
│   ├── ui/                   # Genéricos reutilizables (sin conocimiento del dominio)
│   │   ├── Modal.tsx         # Shell: overlay + panel centrado + portal + cierre Escape/click-fuera
│   │   ├── ConfirmModal.tsx  # Diálogo de confirmación (primary / destructive)
│   │   └── Toast.tsx         # Notificación individual (success / error) con auto-dismiss
│   │
│   ├── ApiKeySetup.tsx       # Pantalla onboarding (fullscreen, bloquea acceso)
│   ├── SettingsModal.tsx     # Modal: ver/cambiar/eliminar API key
│   ├── Header.tsx            # AppBar: título + exportar + importar + engranaje
│   ├── Toolbar.tsx           # Barra: + Nueva tarea + búsqueda + filtro estado + orden
│   ├── TaskList.tsx          # Lista de tarjetas + empty states
│   ├── TaskCard.tsx          # Tarjeta presentacional (solo emite eventos, sin modales)
│   ├── TaskModal.tsx         # Modal crear/editar tarea (formulario)
│   ├── IceBadge.tsx          # Score ICE + desglose I/C/E + fuente + justificación
│   ├── AiEstimateButton.tsx  # Botón con 3 estados visuales (normal/loading/disabled)
│   └── MainView.tsx          # Orquestador: filtros + modales centralizados + layout
│
├── context/                  # Providers de contexto React
│   ├── TaskContext.tsx       # Estado de tareas (useReducer + Context + persistencia)
│   ├── ApiKeyContext.tsx     # Estado de la API key (Context + persistencia)
│   └── ToastContext.tsx      # Toast activo (Context, sin persistencia)
│
├── hooks/                    # Custom hooks
│   ├── useLocalStorage.ts    # Genérico: sincroniza estado ↔ localStorage + evento storage
│   ├── useTaskFilters.ts     # Filtra y ordena tareas (encapsula useMemo + lógica)
│   ├── useTasks.ts           # Facade: consume TaskContext, expone funciones helper
│   ├── useApiKey.ts          # Facade: consume ApiKeyContext
│   └── useToast.ts           # Facade: consume ToastContext (showToast)
│
├── services/                 # Llamadas externas (sin React)
│   └── gemini.ts             # estimateIce(apiKey, title, description): Promise<IceScore>
│
├── types/                    # Tipos TypeScript (sin runtime)
│   └── task.ts               # TaskStatus, IceScore, Task, TaskAction
│
├── utils/                    # Funciones puras (sin React, sin side effects)
│   ├── ice.ts                # calculateIceScore, clampIce, sanitizeIceValue
│   ├── task.ts               # createTask, hasAnyIce, hasCompleteIce
│   └── exportImport.ts       # exportTasks, parseImportFile, validateTaskArray
│
├── App.tsx                   # Root: providers + renderizado condicional (onboarding vs main)
├── main.tsx                  # Entry point (ReactDOM.createRoot)
└── index.css                 # Tailwind directives
```

### Criterios de organización

| Carpeta | Contiene | Qué NO va aquí |
|---------|----------|-----------------|
| `components/ui/` | Componentes genéricos que reciben todo por props. No importan tipos de dominio (`Task`, `IceScore`). | Lógica de negocio, imports de contextos |
| `components/` | Componentes del dominio. Pueden consumir hooks y conocer tipos de negocio. | Definición de reducers o providers |
| `context/` | Providers, reducers, y los objetos Context. Cada archivo exporta el Provider y el Context. | JSX de presentación |
| `hooks/` | Custom hooks que consumen contextos, encapsulan lógica reutilizable, o abstraen APIs del navegador. | Lógica que no sea reutilizable entre componentes |
| `services/` | Código asíncrono con side effects (fetch). Funciones puras de I/O, sin dependencia de React. | Nada que use hooks o JSX |
| `utils/` | Funciones puras, sin estado, sin React, sin side effects. Testables de forma aislada. | Nada con `import React` |
| `types/` | Solo tipos e interfaces TypeScript. Cero runtime. | Funciones, constantes |

### Diferencias con la v1

- Se añade `MainView.tsx` como componente explícito (antes estaba implícito en `App.tsx`).
- Se añade `useTaskFilters.ts` para extraer la lógica de filtrado/ordenación del componente.
- Se elimina la referencia a "cola" en `ToastContext` (ahora es un solo toast activo).

---

## 2. División en componentes

### 2.1 Árbol de componentes

```
<App>
 └── <Providers>                               ← Toast > ApiKey > Task (orden explicado en §3.7)
      │
      ├── <Toast />                            ← fixed top-right, sobre todo (portal)
      │
      ├── if !hasApiKey ──→ <ApiKeySetup />
      │
      └── if hasApiKey ──→ <MainView />        ← ORQUESTADOR
           │
           ├── <Header />
           │    └── abre → <SettingsModal />
           │                  └── abre → <ConfirmModal />  (eliminar key)
           │
           ├── <Toolbar />                     ← componente controlado (sin estado propio)
           │
           ├── <TaskList />
           │    └── <TaskCard /> × N           ← PRESENTACIONAL (sin modales propios)
           │         ├── <IceBadge />          ← pura presentación
           │         ├── <AiEstimateButton />  ← solo botón + loading, sin modal
           │         ├── select estado         ← cambio inline
           │         ├── botón Editar          ← emite onEdit(task)
           │         └── botón Eliminar        ← emite onDelete(task)
           │
           ├── <TaskModal />                   ← ÚNICA instancia (crear + editar)
           └── <ConfirmModal />                ← ÚNICA instancia (eliminar, IA, importar)
```

**Cambio clave respecto a v1:** Los modales ya no viven dentro de `TaskCard` ni de `AiEstimateButton`. Hay una sola instancia de `ConfirmModal` y una sola de `TaskModal` en `MainView`, controladas por el estado del orquestador. `TaskCard` solo emite eventos hacia arriba.

### 2.2 Ficha por componente

#### Componentes UI genéricos (`components/ui/`)

**`Modal`** — Shell reutilizable

| Aspecto | Detalle |
|---------|---------|
| Props | `isOpen`, `onClose`, `children`, `maxWidth?: 'sm' \| 'md' \| 'lg'` |
| Responsabilidad | Overlay semitransparente, panel centrado con bordes redondeados, cierre con Escape / click fuera. Renderiza con `createPortal` a `document.body`. |
| Estado local | Listener de `keydown` para Escape (cleanup en unmount) |
| Justificación | Los tres modales de la app (`TaskModal`, `SettingsModal`, `ConfirmModal`) comparten esta mecánica. Extraerla evita triplicar código. |

**`ConfirmModal`** — Diálogo de confirmación genérico

| Aspecto | Detalle |
|---------|---------|
| Props | `isOpen`, `title`, `message`, `confirmLabel`, `cancelLabel?`, `variant: 'primary' \| 'destructive'`, `onConfirm`, `onCancel` |
| Responsabilidad | Compone `<Modal maxWidth="sm">`. Renderiza título, mensaje y dos botones. No tiene lógica de negocio. |
| Estado local | Ninguno |
| Usos | Eliminar tarea, calcular/recalcular ICE, importar JSON, eliminar API key |

**`Toast`** — Notificación

| Aspecto | Detalle |
|---------|---------|
| Props | `message`, `type: 'success' \| 'error'`, `onClose` |
| Responsabilidad | Renderiza notificación con icono, texto y botón X. Auto-dismiss con `useEffect` + `setTimeout` (3s success, 5s error). Limpia el timer en unmount. |
| Estado local | `useRef` para el timer (evitar memory leak en unmount) |

#### Componentes de dominio (`components/`)

**`App`** — Root

| Aspecto | Detalle |
|---------|---------|
| Responsabilidad | Monta los providers en el orden correcto. Lee `hasApiKey` del contexto. Renderiza `<ApiKeySetup />` o `<MainView />` condicionalmente. Renderiza `<Toast />`. |
| Estado local | Ninguno |
| No hace | No gestiona filtros, modales, ni lógica de tareas |

**`MainView`** — Orquestador de la pantalla principal

| Aspecto | Detalle |
|---------|---------|
| Consume | `useTasks`, `useToast` |
| Usa hook | `useTaskFilters(tasks)` para obtener tareas procesadas |
| Estado local | `searchQuery`, `statusFilter`, `sortOrder` (filtros), `modalState` (ver §2.3) |
| Renderiza | `<Header>`, `<Toolbar>`, `<TaskList>`, + una instancia de `<TaskModal>` + una instancia de `<ConfirmModal>` |
| Responsabilidad | Traduce eventos de los hijos en acciones del contexto y en apertura/cierre de modales. Es el único componente que decide qué modal se muestra y con qué datos. |

**`ApiKeySetup`** — Pantalla de onboarding

| Aspecto | Detalle |
|---------|---------|
| Consume | `useApiKey` (setApiKey), `useToast` (showToast) |
| Estado local | `inputValue: string` |
| Renderiza | Card centrada fullscreen: input + botón disabled si vacío |
| Corresponde a | Mockup `03-mockup-onboarding.svg`, Flujo 1 en UX_Flow.md |

**`Header`** — Barra superior (AppBar)

| Aspecto | Detalle |
|---------|---------|
| Props | `onImportTasks: (tasks: Task[]) => void` |
| Consume | `useTasks` (tasks — solo lectura, para exportar), `useToast` |
| Estado local | `isSettingsOpen: boolean` |
| Renderiza | Título + botones Exportar/Importar + icono engranaje. Contiene `<SettingsModal>` (porque es un modal autónomo que no interactúa con la lista de tareas). |
| No hace | No contiene `ConfirmModal` de importación — ese lo gestiona `MainView` |

**`SettingsModal`** — Gestión de API key

| Aspecto | Detalle |
|---------|---------|
| Props | `isOpen`, `onClose` |
| Consume | `useApiKey`, `useToast` |
| Estado local | `newKeyInput: string`, `isDeleteConfirmOpen: boolean` |
| Renderiza | Compone `<Modal>`. Key enmascarada + input + Guardar + Eliminar. Contiene su propio `<ConfirmModal>` anidado para eliminar key (aceptable: es un flujo autocontenido, no se multiplica por N). |

**`Toolbar`** — Barra de acciones y filtros

| Aspecto | Detalle |
|---------|---------|
| Props | `searchQuery`, `onSearchChange`, `statusFilter`, `onStatusFilterChange`, `sortOrder`, `onSortOrderChange`, `onNewTask` |
| Estado local | Ninguno. Componente controlado. |
| Renderiza | Botón "+ Nueva tarea", input búsqueda, select estado, select orden |

**`TaskList`** — Lista de tareas

| Aspecto | Detalle |
|---------|---------|
| Props | `tasks: Task[]` (ya procesadas), `hasActiveFilters: boolean`, `onEdit: (task) => void`, `onDelete: (task) => void`, `onEstimate: (task) => void`, `onStatusChange: (id, status) => void`, `onNewTask: () => void`, `onClearFilters: () => void` |
| Estado local | Ninguno |
| Renderiza | Mapea `tasks` a `<TaskCard>`. Si vacío: empty state diferenciado (sin tareas vs. sin resultados según `hasActiveFilters`). |
| No hace | No filtra, no ordena, no gestiona modales |

**`TaskCard`** — Tarjeta de tarea (PRESENTACIONAL)

| Aspecto | Detalle |
|---------|---------|
| Props | `task`, `onEdit`, `onDelete`, `onEstimate`, `onStatusChange` |
| Estado local | Ninguno |
| Renderiza | 3 zonas: cabecera (título + select estado), cuerpo (`<IceBadge>`), acciones (`<AiEstimateButton>` + Editar + Eliminar) |
| No hace | No instancia modales. No llama al reducer directamente. Solo emite eventos vía props. |
| Cambio vs v1 | Antes tenía `isDeleteConfirmOpen` y un `<ConfirmModal>` interno. Ahora es puro. |

**`IceBadge`** — Visualización del ICE Score

| Aspecto | Detalle |
|---------|---------|
| Props | `ice: IceScore` |
| Estado local | Ninguno |
| Renderiza | Score numérico o "Pendiente", desglose I/C/E, chip fuente (IA/Manual), justificación en itálica |
| Componente puro | Solo presentación |

**`AiEstimateButton`** — Botón de estimación IA

| Aspecto | Detalle |
|---------|---------|
| Props | `task`, `disabled: boolean`, `disabledReason?: string`, `isLoading: boolean`, `onRequestEstimate: () => void` |
| Estado local | Ninguno |
| Renderiza | Botón con 3 estados visuales: normal (click emite `onRequestEstimate`), loading (spinner + "Calculando..." + disabled), disabled (gris + tooltip con `disabledReason`) |
| Cambio vs v1 | Antes consumía contextos, gestionaba `isLoading`, contenía `<ConfirmModal>` y llamaba directamente al servicio `gemini.ts`. Ahora es presentacional: el estado de loading y la lógica de IA la gestiona `MainView`. |

**`TaskModal`** — Formulario crear/editar

| Aspecto | Detalle |
|---------|---------|
| Props | `isOpen`, `task?: Task` (si viene → edición), `onSave: (data: TaskFormData) => void`, `onClose` |
| Estado local | Campos del formulario: `title`, `description`, `status`, `impact`, `confidence`, `ease`, `titleError: boolean` |
| Renderiza | Compone `<Modal maxWidth="md">`. Campos de texto, select estado (solo edición), inputs ICE opcionales, botones Cancelar/Guardar |
| No hace | No llama a `addTask` ni `updateTask`. Solo empaqueta los datos del formulario y los emite con `onSave`. El padre decide qué acción del reducer disparar. |

### 2.3 Estado del orquestador (MainView)

`MainView` gestiona un estado de "qué modal está abierto y con qué datos" usando un patrón de máquina de estados simple:

```
modalState:
  | { type: 'closed' }
  | { type: 'create-task' }
  | { type: 'edit-task', task: Task }
  | { type: 'confirm-delete', task: Task }
  | { type: 'confirm-estimate', task: Task }
  | { type: 'confirm-import', pendingTasks: Task[] }
```

Esto reemplaza el enfoque de v1 con múltiples booleanos independientes (`isTaskModalOpen`, `isDeleteConfirmOpen`, `isImportConfirmOpen`...) que podían entrar en estados inconsistentes (dos modales abiertos simultáneamente).

Con un solo `modalState`, solo un modal puede estar abierto a la vez (excepto `SettingsModal` que vive en `Header` y es autónomo).

El estado de loading para la estimación IA también vive aquí:

```
estimatingTaskId: string | null
```

Cuando no es `null`, el `AiEstimateButton` de esa tarea recibe `isLoading={true}`.

### 2.4 Flujo de datos para las operaciones principales

**Eliminar tarea:**

```
TaskCard                           MainView                          TaskContext
  │                                  │                                  │
  │ onDelete(task)                   │                                  │
  │ ─────────────────────────────→   │                                  │
  │                                  │ setModalState({                  │
  │                                  │   type:'confirm-delete',         │
  │                                  │   task                           │
  │                                  │ })                               │
  │                                  │                                  │
  │                          <ConfirmModal>                             │
  │                            user confirms                           │
  │                                  │                                  │
  │                                  │ deleteTask(task.id) ──────────→  │
  │                                  │ setModalState({type:'closed'})   │
```

**Estimar ICE con IA:**

```
TaskCard                           MainView                          TaskContext
  │                                  │                                  │
  │ onEstimate(task)                 │                                  │
  │ ─────────────────────────────→   │                                  │
  │                                  │ setModalState({                  │
  │                                  │   type:'confirm-estimate',       │
  │                                  │   task                           │
  │                                  │ })                               │
  │                                  │                                  │
  │                          <ConfirmModal>                             │
  │                            user confirms                           │
  │                                  │                                  │
  │                                  │ setEstimatingTaskId(task.id)     │
  │                                  │ setModalState({type:'closed'})   │
  │                                  │                                  │
  │                                  │ await estimateIce(...)           │
  │                                  │   (gemini.ts)                    │
  │                                  │                                  │
  │                                  │── success ──→ updateIceAi(       │
  │                                  │                 task.id, result) │
  │                                  │               showToast(éxito)  │
  │                                  │                                  │
  │                                  │── error ────→ showToast(error)  │
  │                                  │                                  │
  │                                  │ setEstimatingTaskId(null)        │
```

---

## 3. Gestión del estado

### 3.1 Mapa de estado

```
┌─────────────────────────────────────────────────────────────────┐
│                         ESTADO GLOBAL                           │
│                    (Context + useReducer)                        │
│                                                                 │
│  ┌──────────────────────┐  ┌───────────────┐  ┌──────────────┐ │
│  │ TaskContext           │  │ ApiKeyContext  │  │ ToastContext │ │
│  │                      │  │               │  │              │ │
│  │ tasks: Task[]        │  │ apiKey: string│  │ toast: obj   │ │
│  │ dispatch(action)     │  │ setApiKey()   │  │   | null     │ │
│  │                      │  │ clearApiKey() │  │ showToast()  │ │
│  │ Persiste: LS "tasks" │  │ hasApiKey     │  │              │ │
│  │                      │  │               │  │ Sin persist. │ │
│  │                      │  │ Persiste: LS  │  │ (efímero)    │ │
│  │                      │  │ "gemini_api   │  │              │ │
│  │                      │  │  _key"        │  │              │ │
│  └──────────────────────┘  └───────────────┘  └──────────────┘ │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                         ESTADO LOCAL                            │
│                        (useState en cada componente)            │
│                                                                 │
│  MainView:                                                      │
│  ├── searchQuery: string                                        │
│  ├── statusFilter: 'all' | 'backlog' | 'doing' | 'done'       │
│  ├── sortOrder: 'ice' | 'date' | 'title'                      │
│  ├── modalState: ModalState  (máquina de estados, ver §2.3)   │
│  └── estimatingTaskId: string | null                           │
│                                                                 │
│  ApiKeySetup:                                                   │
│  └── inputValue: string                                         │
│                                                                 │
│  Header:                                                        │
│  └── isSettingsOpen: boolean                                    │
│                                                                 │
│  SettingsModal:                                                 │
│  ├── newKeyInput: string                                        │
│  └── isDeleteConfirmOpen: boolean                               │
│                                                                 │
│  TaskModal:                                                     │
│  ├── title, description, status: string                         │
│  ├── impact, confidence, ease: string (inputs de formulario)    │
│  └── titleError: boolean                                        │
│                                                                 │
│  TaskCard: NINGUNO                                              │
│  AiEstimateButton: NINGUNO                                      │
│  IceBadge: NINGUNO                                              │
│  TaskList: NINGUNO                                              │
│  Toolbar: NINGUNO                                               │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 TaskContext: diseño del reducer

Usa `useReducer` porque el estado es un array con múltiples operaciones que se benefician de acciones tipadas. El reducer es el **único punto de mutación** de datos de tareas.

**Tipo del estado:**

```
State = { tasks: Task[] }
```

**Acciones del reducer:**

| Acción | Payload | Efecto | Reglas de negocio que encapsula |
|--------|---------|--------|--------------------------------|
| `ADD_TASK` | `{ title, description? }` | Crea tarea con `createTask()`, la añade al array | Estado inicial `backlog`, ICE vacío |
| `UPDATE_TASK` | `{ id, changes: Partial<Task> }` | Merge parcial, actualiza `updatedAt` | Uso general (título, descripción, estado) |
| `UPDATE_ICE_MANUAL` | `{ id, impact?, confidence?, ease? }` | Actualiza I/C/E, recalcula `score`, `source='manual'`, borra `rationale` | Si se editan I/C/E manualmente, la justificación IA deja de aplicar |
| `UPDATE_ICE_AI` | `{ id, impact, confidence, ease, rationale }` | Actualiza I/C/E + rationale, recalcula `score`, `source='ai'` | Preserva la justificación de la IA |
| `DELETE_TASK` | `{ id }` | Filtra la tarea del array | — |
| `SET_TASKS` | `{ tasks: Task[] }` | Reemplaza todo el array | Para importar JSON |

**Cambio vs v1:** Antes había un único `UPDATE_TASK` genérico que mezclaba ediciones de campos simples con mutaciones de ICE. Ahora `UPDATE_ICE_MANUAL` y `UPDATE_ICE_AI` son acciones explícitas con reglas de negocio diferenciadas. Esto evita que la lógica de "si cambio ICE manual, borro rationale" esté dispersa en componentes.

**Flujo de datos:**

```
Componente
    │
    │ llama hook useTasks()
    │ que expone: tasks, addTask(), updateTask(),
    │             updateIceManual(), updateIceAi(),
    │             deleteTask(), setTasks()
    ▼
useTasks (hook facade)
    │
    │ dispatch(action)
    ▼
taskReducer (función pura)
    │
    │ nuevo state
    ▼
TaskContext.Provider
    │
    │ useEffect: sincroniza state → localStorage
    ▼
localStorage (clave "tasks")
    │
    │ evento "storage" (otra pestaña escribió)
    ▼
useLocalStorage detecta cambio → actualiza state
```

### 3.3 ApiKeyContext

Estado simple, no necesita reducer. Un `useState` envolviendo `useLocalStorage`.

```
ApiKeyContext.Provider
    │
    │ value = { apiKey, setApiKey, clearApiKey, hasApiKey }
    ▼
useLocalStorage<string>('gemini_api_key', '')
```

`hasApiKey` es un valor derivado (`apiKey.length > 0`), no se almacena.

### 3.4 ToastContext (simplificado)

**Cambio vs v1:** Se elimina la cola FIFO. Solo hay un toast activo a la vez.

```
ToastContext.Provider
    │
    │ value = { toast, showToast, dismissToast }
    ▼
useState<{ message: string, type: 'success' | 'error' } | null>(null)
```

Comportamiento:
- `showToast(message, type)` reemplaza cualquier toast anterior.
- `dismissToast()` pone el estado a `null`.
- El componente `<Toast>` gestiona su propio timer de auto-dismiss y llama a `dismissToast` al expirar.
- Si se llama a `showToast` mientras hay un toast activo, el anterior se descarta inmediatamente y el nuevo toma su lugar. Esto elimina la necesidad de gestionar ids, colas y cleanup de múltiples timers.

El `<Toast>` se renderiza en un contenedor fijo (`fixed top-4 right-4 z-50`) dentro del Provider, fuera del flujo de la app, lo que garantiza que aparece sobre cualquier modal.

### 3.5 Persistencia: useLocalStorage

Hook genérico que abstrae lectura/escritura a localStorage:

```
useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void]
```

Comportamiento:
- **Lectura inicial:** intenta `JSON.parse(localStorage.getItem(key))`. Si falla o no existe, usa `initialValue`.
- **Escritura:** en cada llamada al setter, escribe `JSON.stringify(value)` en localStorage.
- **Errores:** si el JSON almacenado está corrupto, lo ignora silenciosamente y usa `initialValue`.
- **Sincronización entre pestañas:** escucha el evento `storage` del navegador. Si otra pestaña modifica la misma key, actualiza el estado local automáticamente. Esto evita que dos pestañas abiertas se sobreescriban mutuamente.

### 3.6 useTaskFilters: hook de filtrado y ordenación

Encapsula la lógica de filtrado y ordenación que antes vivía directamente en el componente orquestador.

```
useTaskFilters(tasks: Task[], filters: {
  searchQuery: string,
  statusFilter: 'all' | 'backlog' | 'doing' | 'done',
  sortOrder: 'ice' | 'date' | 'title'
}): {
  filteredTasks: Task[],
  hasActiveFilters: boolean
}
```

Internamente usa `useMemo` con las dependencias correctas. La lógica:
- **Filtro de estado:** si `statusFilter !== 'all'`, filtra por `task.status === statusFilter`.
- **Búsqueda de texto:** case-insensitive `includes` sobre `title` y `description`. AND lógico con el filtro de estado.
- **Ordenación:** ICE desc (`score ?? -1` para pendientes al final), fecha desc (`createdAt` ISO), título asc (`localeCompare`).
- **`hasActiveFilters`:** `true` si `searchQuery !== '' || statusFilter !== 'all'`. Se usa para diferenciar los empty states.

Los componentes hijos (`TaskList`, `TaskCard`) reciben las tareas ya procesadas y no filtran ni ordenan.

### 3.7 Orden de providers

```
<ToastContext.Provider>       ← más externo: cualquier componente puede lanzar toasts
  <ApiKeyContext.Provider>    ← segundo: renderizado condicional depende de hasApiKey
    <TaskContext.Provider>    ← tercero: las tareas solo se usan si hay API key
      <App content />
    </TaskContext.Provider>
  </ApiKeyContext.Provider>
</ToastContext.Provider>
```

Justificación:
- **Toast primero:** `ApiKeySetup` necesita mostrar toasts, pero no necesita tareas.
- **ApiKey antes de Task:** si no hay key, se muestra onboarding y no tiene sentido hidratar el estado de tareas desde localStorage.

### 3.8 Estado derivado

| Valor derivado | Calculado en | Dependencias |
|---------------|-------------|-------------|
| `hasApiKey` | `useApiKey` | `apiKey` |
| `filteredTasks` | `useTaskFilters` | `tasks`, `searchQuery`, `statusFilter`, `sortOrder` |
| `hasActiveFilters` | `useTaskFilters` | `searchQuery`, `statusFilter` |
| `isEstimating(taskId)` | `MainView` | `estimatingTaskId` |

---

## 4. Resumen de decisiones arquitectónicas

| Decisión | Elección | Alternativa descartada | Motivo |
|----------|----------|----------------------|--------|
| Estado global | `useReducer` + `useContext` | Zustand | Proyecto educativo, enseñar React puro |
| Contextos | 3 separados (Task, ApiKey, Toast) | 1 monolítico | Acotar re-renders |
| Toasts | Un solo toast activo (`T \| null`) | Cola FIFO con ids | Complejidad innecesaria para MVP |
| Persistencia | Hook custom `useLocalStorage` con evento `storage` | `usehooks-ts` | Ejercicio didáctico + sincronización entre pestañas |
| Modales | Instancia única en `MainView` + `modalState` tipado | Modal por cada `TaskCard` | Evitar N instancias de lógica por N tareas |
| Estado de modales | Unión discriminada (máquina de estados) | Múltiples booleanos | Evitar estados inconsistentes |
| TaskCard | Presentacional (sin estado, sin modales, sin contextos) | TaskCard "inteligente" | Simplificar, evitar acoplamiento |
| AiEstimateButton | Presentacional (recibe `isLoading` por props) | Gestiona su propio loading + llama servicio | La lógica async vive en MainView |
| Lógica ICE | Acciones específicas en reducer (`UPDATE_ICE_MANUAL`, `UPDATE_ICE_AI`) | Un solo `UPDATE_TASK` genérico | Centralizar reglas de negocio en un punto |
| Filtrado | Hook `useTaskFilters` | `useMemo` inline en MainView | Mantener MainView limpio, lógica testeable |
| Navegación | Renderizado condicional en `App` | React Router | No hay rutas, SPA simple |
| HTTP | `fetch` nativo | Axios | Sin dependencias extra |
| Estilos | Tailwind CSS (utilidades en JSX) | CSS Modules | Definido en el spec |
