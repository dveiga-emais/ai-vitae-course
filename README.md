# Gestor de Tareas ICE — Minimum Spec Pack

MVP de un gestor de tareas para curso de React que prioriza usando el modelo ICE (Impact, Confidence, Ease) y permite estimacion automatica con Google Gemini API.

---

## 1. Objetivo del MVP

- Crear, editar y eliminar tareas.
- Asignar y visualizar prioridad ICE.
- Calcular ICE automaticamente desde I/C/E.
- Ordenar y filtrar tareas por prioridad.
- Persistir todo en el navegador (sin backend).

---

## 2. Alcance funcional

### 2.1 API Key (Onboarding)

- Si no hay key en `localStorage`, se muestra pantalla de bienvenida a pantalla completa.
- Input para pegar la key y boton “Guardar y continuar”.
- Link a Google AI Studio: `https://aistudio.google.com/apikey`.
- La key se guarda en `localStorage` con clave `gemini_api_key`.

### 2.2 CRUD de tareas

- Crear con titulo obligatorio y descripcion opcional.
- Editar desde modal pre-rellenado.
- Eliminar con confirmacion obligatoria (modal propio).
- Cambiar estado desde select (`backlog`, `doing`, `done`).

### 2.3 Priorizacion ICE

- ICE score = media redondeada de I/C/E.
- Si falta alguna variable, el score queda como “Pendiente”.
- Se muestra desglose I/C/E en la tarjeta.

### 2.4 Estimacion con IA (Gemini)

- Boton “Calcular ICE con IA”.
- Confirmacion antes de llamar a la API.
- Loading en el boton durante la estimacion.
- Exito: guarda I/C/E y justificacion, muestra toast.
- Error: no cambia valores, muestra toast.

### 2.5 Persistencia y JSON

- Persistencia automatica en `localStorage`.
- Exportar tareas a JSON.
- Importar JSON con confirmacion y reemplazo total.

---

## 3. Fuera de alcance

- Backend, usuarios, auth o permisos.
- Sincronizacion multi-dispositivo.
- Tags/categorias.
- Drag & drop.
- Variables de entorno para API key (`.env` no se usa).

---

## 4. Modelo de datos

```ts
type TaskStatus = 'backlog' | 'doing' | 'done'

type IceScore = {
  impact?: number
  confidence?: number
  ease?: number
  score?: number
  rationale?: string
  source?: 'manual' | 'ai'
}

type Task = {
  id: string
  title: string
  description?: string
  status: TaskStatus
  createdAt: string
  updatedAt: string
  ice: IceScore
}
```

---

## 5. Reglas ICE

- ICE = `(Impact + Confidence + Ease) / 3`
- Redondeado con `Math.round`.
- Clamp a rango `0..100`.
- Si falta cualquiera de I/C/E, el score no se calcula.

---

## 6. Arquitectura (v2)

### 6.1 Componentes principales

- `ApiKeySetup`: onboarding (pantalla completa).
- `MainView`: orquestador de la app (filtros + modales).
- `TaskList` → `TaskCard` → `IceBadge`.
- `TaskModal`: crear/editar.
- `ConfirmModal`: confirmaciones globales.
- `Toast`: notificaciones.

### 6.2 Modales centralizados

- Una sola instancia de `TaskModal` y `ConfirmModal` en `MainView`.
- `TaskCard` es presentacional y no contiene logica ni modales.

### 6.3 Estado global

- `useReducer` + `useContext`
- Contextos separados:
  - `TaskContext`
  - `ApiKeyContext`
  - `ToastContext`

---

## 7. Persistencia con inversion de dependencias

Se introduce un adapter unico en `services/` para desacoplar React de la persistencia:

- `services/persistence.ts` define el contrato.
- `services/persistence.localStorage.ts` implementa localStorage.
- `main.tsx` configura el adapter en un unico punto.

Si manana se usa PostgreSQL, solo se cambia el adapter en `services/` sin tocar React.

---

## 8. UX y UI (Tailwind + Material UI style)

- Componentes con estilo Material UI (cards, chips, inputs outlined).
- Confirmaciones con modales propios (no `window.confirm`).
- Toasts para feedback.
- Responsive basico.

---

## 9. Stack tecnico

- React + TypeScript + Vite
- Tailwind CSS
- Persistencia local (`localStorage`)
- Integracion con Google Gemini API via `fetch`

---

## 10. Flujo principal

1. Usuario entra sin key → onboarding.
2. Guarda key → entra a la app.
3. Crea tareas → ICE pendiente.
4. Edita ICE manual o por IA.
5. Filtra, ordena, exporta/importa.
6. Todo persiste en localStorage.

---

## 11. Referencias internas

- `MVP_Gestor_Tareas_Inteligente_ICE.md` — especificacion completa.
- `design/UX_Flow.md` — flujos UX y jerarquia de componentes.
- `Arquitectura_React.md` — arquitectura v2.
- `Implementacion.md` — guia de implementacion paso a paso.
