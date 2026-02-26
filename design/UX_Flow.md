# UX: Flujo de usuario y jerarquia de pantallas

Documento de diseno UX para el Gestor de Tareas ICE.
Define el flujo completo del usuario, la jerarquia de pantallas y los componentes principales.
No contiene codigo — solo estructura funcional y visual.

---

## 1. Mapa de pantallas

La app tiene **dos pantallas** y **cuatro modales**. No hay router — todo se resuelve con renderizado condicional y overlays.

```
App
 │
 ├── [1] ApiKeySetup         (pantalla completa, bloquea el acceso)
 │        Se muestra si: !localStorage['gemini_api_key']
 │
 └── [2] MainView            (pantalla principal)
          Se muestra si: localStorage['gemini_api_key'] existe
          │
          ├── Header
          │    └── abre → SettingsModal [M1]
          │
          ├── Toolbar
          │    └── abre → TaskModal [M2] (modo creacion)
          │
          └── TaskList
               └── TaskCard (x N)
                    ├── abre → TaskModal [M2] (modo edicion)
                    ├── abre → ConfirmModal [M3] (eliminar tarea)
                    └── abre → ConfirmModal [M3] (calcular ICE con IA)
```

**Modales:**

| ID | Modal | Disparado por |
|----|-------|---------------|
| M1 | `SettingsModal` | Boton engranaje en Header |
| M2 | `TaskModal` | Boton "+ Nueva tarea" en Toolbar, o boton "Editar" en TaskCard |
| M3 | `ConfirmModal` | Eliminar tarea, Calcular ICE con IA, Importar JSON, Eliminar API key |

**Notificaciones transversales:**

| Componente | Aparece en |
|------------|------------|
| `Toast` | Esquina superior derecha, sobre cualquier pantalla/modal |

---

## 2. Flujo de usuario completo

### Flujo 1: Primera visita (onboarding)

```
Usuario abre la app
       │
       ▼
┌─ ¿Hay API key en localStorage? ─┐
│                                  │
│  NO                              │  SI
│                                  │
▼                                  ▼
[Pantalla ApiKeySetup]         [Pantalla MainView]
  │                              (ir a Flujo 3)
  │  Usuario pega la key
  │  Pulsa "Guardar y continuar"
  │
  ▼
  Se guarda en localStorage
  Toast exito: "API key guardada"
  │
  ▼
  [Pantalla MainView]
  (lista vacia, empty state)
```

### Flujo 2: Crear una tarea

```
[MainView]
  │
  │  Pulsa "+ Nueva tarea" en Toolbar
  │
  ▼
[TaskModal - modo creacion]
  │
  │  Rellena titulo (obligatorio)
  │  Rellena descripcion (opcional)
  │  Estado: backlog (fijo, no editable)
  │  ICE: puede dejar vacio o rellenar manualmente
  │
  ├── Pulsa "Cancelar" → cierra modal, no pasa nada
  │
  └── Pulsa "Guardar"
       │
       ├── Titulo vacio? → error inline, no cierra
       │
       └── Titulo valido
            │
            ▼
       Tarea creada con ICE "Pendiente"
       (salvo que haya rellenado I/C/E manualmente)
       Se guarda en localStorage
       Modal se cierra
       La tarjeta aparece en la lista
```

### Flujo 3: Estimar ICE con IA (flujo principal del MVP)

Este es el flujo mas importante. Describe el camino desde una tarea sin ICE hasta tener un score sugerido por la IA y confirmado.

```
[MainView - TaskCard]
  │
  │  El usuario ve una tarjeta con ICE "Pendiente"
  │  Decide usar la IA para estimar
  │
  │  ¿El boton "Calcular ICE con IA" esta habilitado?
  │
  ├── NO (gris, deshabilitado)
  │    │
  │    ├── Razon: sin descripcion
  │    │   Tooltip: "Añade una descripcion para poder estimar con IA"
  │    │   → El usuario pulsa "Editar", anade descripcion, guarda
  │    │   → Vuelve a la tarjeta, ahora el boton esta habilitado
  │    │
  │    └── Razon: sin API key
  │        Tooltip: "Configura tu API key primero"
  │        → El usuario va a Settings, introduce la key
  │        → Vuelve a la tarjeta, ahora el boton esta habilitado
  │
  └── SI (habilitado)
       │
       │  Pulsa "Calcular ICE con IA"
       │
       ▼
  ┌─ ¿La tarea ya tiene valores I/C/E? ─┐
  │                                      │
  │  NO                                  │  SI
  │                                      │
  ▼                                      ▼
  [ConfirmModal]                    [ConfirmModal]
  "¿Quieres que la IA             "Esta tarea ya tiene
   estime el ICE para              valores ICE. ¿Quieres
   esta tarea?"                    sobreescribirlos con
                                    la estimacion de la IA?"
  │                                      │
  ├── Cancela → cierra modal             ├── Cancela → cierra modal
  │                                      │
  └── Confirma                           └── Confirma
       │                                      │
       └──────────────┬───────────────────────┘
                      │
                      ▼
            Boton pasa a estado loading
            [Spinner + "Calculando..." + disabled]
                      │
                      ▼
            fetch POST a Gemini API
                      │
              ┌───────┴───────┐
              │               │
           EXITO           ERROR
              │               │
              ▼               ▼
     Se guardan I/C/E    Toast error:
     + rationale +       "Error al calcular
     source: 'ai'        ICE: {mensaje}"
     en la tarea          │
              │           │  Valores existentes
              ▼           │  NO se modifican
     Se calcula score     │
     Math.round(          │  Boton vuelve a
      (I+C+E)/3)          │  estado normal
              │           │
              ▼           ▼
     Toast exito:    [TaskCard sin cambios]
     "ICE calculado
      correctamente"
              │
              ▼
     [TaskCard actualizada]
     Score numerico visible
     Desglose I/C/E visible
     "Fuente: IA"
     Justificacion en italica
              │
              ▼
     La tarjeta se reposiciona
     en la lista segun su nuevo
     score (orden ICE descendente)
```

### Flujo 4: Editar una tarea (ajustar ICE manualmente)

```
[MainView - TaskCard]
  │
  │  Pulsa "Editar"
  │
  ▼
[TaskModal - modo edicion]
  │
  │  Formulario pre-rellenado con datos actuales
  │  Puede modificar: titulo, descripcion, estado, I/C/E
  │
  │  Si modifica I/C/E manualmente:
  │    - source cambia a 'manual'
  │    - rationale se borra (ya no aplica)
  │    - score se recalcula automaticamente
  │
  ├── Pulsa "Cancelar" → cierra, no guarda nada
  │
  └── Pulsa "Guardar"
       │
       ▼
  Tarea actualizada en localStorage
  Modal se cierra
  TaskCard refleja los nuevos valores
```

### Flujo 5: Eliminar una tarea

```
[TaskCard]
  │
  │  Pulsa "Eliminar"
  │
  ▼
[ConfirmModal - variant destructive]
  "¿Seguro que quieres eliminar
   «{titulo}»? Esta accion no
   se puede deshacer."
  │
  ├── "Cancelar" → cierra, no pasa nada
  │
  └── "Eliminar" (boton rojo)
       │
       ▼
  Tarea eliminada de localStorage
  TaskCard desaparece de la lista
```

### Flujo 6: Exportar / Importar

```
Exportar:
  Header → boton "Exportar"
  → Se descarga tareas-ice.json
  (sin confirmacion, accion segura)

Importar:
  Header → boton "Importar"
  → Se abre selector de archivo (.json)
  → Se parsea el archivo
  │
  ├── Error de formato → Toast error
  │
  └── Formato valido
       │
       ▼
  [ConfirmModal]
  "Esto reemplazara todas las
   tareas actuales. ¿Quieres
   continuar?"
  │
  ├── "Cancelar" → no pasa nada
  │
  └── "Importar"
       │
       ▼
  Tareas reemplazadas
  Toast exito: "Tareas importadas correctamente"
```

---

## 3. Jerarquia de componentes

```
<App>
 │
 ├── <ToastProvider>          ← contexto global para toasts
 │    └── <Toast />           ← renderiza toasts activos (esquina sup. derecha)
 │
 ├── <TaskProvider>           ← contexto global para tareas (useReducer)
 │
 ├── <ApiKeyProvider>         ← contexto global para API key
 │
 └── {contenido condicional}
      │
      ├── if !hasApiKey → <ApiKeySetup />
      │
      └── if hasApiKey →
           │
           ├── <Header>
           │    ├── Logo / Titulo
           │    ├── Boton "Exportar"
           │    ├── Boton "Importar"
           │    └── Boton engranaje → abre <SettingsModal>
           │
           ├── <Toolbar>
           │    ├── Boton "+ Nueva tarea" → abre <TaskModal> (creacion)
           │    ├── Input de busqueda
           │    ├── Select de estado (Todos | Backlog | Doing | Done)
           │    └── Select de orden (ICE desc | Fecha | Titulo)
           │
           └── <TaskList>
                │
                ├── {empty state si no hay tareas}
                │
                └── <TaskCard> (x N)
                     │
                     ├── Titulo
                     ├── Select de estado (cambio directo)
                     ├── <IceBadge>
                     │    ├── Score (numero o "Pendiente")
                     │    ├── Desglose I / C / E
                     │    ├── Fuente (manual | IA)
                     │    └── Justificacion (si fuente IA)
                     │
                     ├── <AiEstimateButton>
                     │    ├── Estado normal: "Calcular ICE con IA"
                     │    ├── Estado loading: spinner + "Calculando..."
                     │    └── Estado disabled: gris + tooltip
                     │
                     ├── Boton "Editar" → abre <TaskModal> (edicion)
                     └── Boton "Eliminar" → abre <ConfirmModal>
```

---

## 4. Descripcion visual de cada componente

### 4.1 ApiKeySetup (pantalla completa)

- **Ocupa**: 100% del viewport, centrado vertical y horizontal.
- **Fondo**: gris claro (`bg-gray-50`).
- **Contenido**: panel blanco centrado (`max-w-md`, `rounded-lg`, `shadow`).
- **Elementos**:
  - Titulo grande: "Gestor de Tareas ICE".
  - Subtitulo: "Configurar API Key de Gemini".
  - Parrafo explicativo breve.
  - Link externo a Google AI Studio (se abre en nueva pestana).
  - Input de texto para la key (ancho completo).
  - Boton primario "Guardar y continuar" (ancho completo, deshabilitado si input vacio).

```
┌──────────────────────────────────────────────┐
│                                              │
│            Gestor de Tareas ICE              │
│                                              │
│       Configurar API Key de Gemini           │
│                                              │
│  Para usar la estimacion con IA, necesitas   │
│  una API key gratuita de Google Gemini.       │
│                                              │
│  → Obtener API key en Google AI Studio ↗     │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ Pega tu API key aqui                   │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │        Guardar y continuar             │  │
│  └────────────────────────────────────────┘  │
│                                              │
└──────────────────────────────────────────────┘
```

### 4.2 Header (barra superior)

- **Posicion**: sticky top, ancho completo.
- **Fondo**: blanco con sombra inferior (`shadow-sm`).
- **Layout**: flex, justify-between, items-center.
- **Izquierda**: titulo "Gestor de Tareas ICE" (texto, no logo).
- **Derecha**: grupo de botones con iconos.

```
┌───────────────────────────────────────────────────────┐
│  Gestor de Tareas ICE         [Exportar] [Importar] ⚙│
└───────────────────────────────────────────────────────┘
```

- Los botones "Exportar" e "Importar" son secundarios (outline o ghost).
- El engranaje es un icono-boton que abre SettingsModal.

### 4.3 Toolbar (barra de acciones)

- **Posicion**: debajo del Header, dentro del contenedor principal.
- **Layout**: flex con wrap en pantallas pequenas.
- **Elementos en una fila**:

```
┌───────────────────────────────────────────────────────┐
│  [+ Nueva tarea]  [🔍 Buscar...    ]  [Estado ▾]  [Orden ▾] │
└───────────────────────────────────────────────────────┘
```

- **"+ Nueva tarea"**: boton primario (azul/indigo), destaca visualmente.
- **Buscar**: input con icono lupa, placeholder "Buscar tareas...".
- **Estado**: select con opciones Todos / Backlog / Doing / Done.
- **Orden**: select con opciones ICE (mayor) / Fecha (reciente) / Titulo (A-Z).
- En movil: el boton y el buscador van en una fila, los selects en otra.

### 4.4 TaskList

- **Layout**: flex column, gap entre tarjetas (`space-y-4`).
- **Contenido**: mapea las tareas filtradas/ordenadas a `<TaskCard>`.
- **Empty state** (sin tareas):

```
┌───────────────────────────────────────┐
│                                       │
│          📋 (icono grande gris)       │
│                                       │
│      No hay tareas todavia            │
│                                       │
│      [Crear tu primera tarea]         │
│                                       │
└───────────────────────────────────────┘
```

- **Empty state** (con filtros activos, sin resultados):

```
┌───────────────────────────────────────┐
│                                       │
│    No se encontraron tareas con       │
│    los filtros actuales.              │
│                                       │
│    [Limpiar filtros]                  │
│                                       │
└───────────────────────────────────────┘
```

### 4.5 TaskCard

Tarjeta rectangular con bordes redondeados y sombra ligera. Es el componente mas complejo visualmente.

**Estructura interna (3 zonas verticales):**

```
┌──────────────────────────────────────────────────────┐
│  ZONA 1: Cabecera                                    │
│  ┌──────────────────────────────────┐  ┌──────────┐  │
│  │ Implementar login con OAuth     │  │ Doing  ▾ │  │
│  └──────────────────────────────────┘  └──────────┘  │
│──────────────────────────────────────────────────────│
│  ZONA 2: Cuerpo (ICE)                                │
│                                                      │
│     72              I: 85    C: 60    E: 70          │
│     ICE Score                                        │
│                                                      │
│     Fuente: IA                                       │
│     "Alto impacto en UX, confianza media por         │
│      dependencia de terceros, facilidad moderada."   │
│                                                      │
│──────────────────────────────────────────────────────│
│  ZONA 3: Acciones                                    │
│  [Calcular ICE con IA]     [Editar]     [Eliminar]   │
└──────────────────────────────────────────────────────┘
```

**Zona 1 — Cabecera:**
- Titulo de la tarea: texto medium/semibold, truncado si es largo.
- Select de estado: badge-select alineado a la derecha.
  - Backlog: gris (`bg-gray-100 text-gray-700`).
  - Doing: amarillo/azul (`bg-yellow-100 text-yellow-800` o `bg-blue-100 text-blue-800`).
  - Done: verde (`bg-green-100 text-green-800`).

**Zona 2 — Cuerpo (IceBadge):**
- Score grande a la izquierda: numero en `text-3xl font-bold` (o "Pendiente" en gris atenuado).
- Desglose I/C/E a la derecha del score, en columna o fila.
- Si source es 'ai': etiqueta "Fuente: IA" en texto pequeno, y justificacion en italica debajo.
- Si source es 'manual': etiqueta "Fuente: Manual" (o no mostrar nada).
- Si no hay ICE: solo muestra "Pendiente" centrado, sin desglose de fuente.

**Zona 3 — Acciones:**
- Barra de botones separados por espacio.
- "Calcular ICE con IA": boton secundario (outline azul). Puede estar disabled.
- "Editar": boton ghost o terciario.
- "Eliminar": boton ghost rojo o texto rojo.

### 4.6 TaskModal (crear / editar)

- **Overlay**: fondo negro semitransparente (`bg-black/50`).
- **Panel**: centrado, `max-w-lg`, `rounded-lg`, `shadow-xl`, fondo blanco.
- **Titulo**: "Crear tarea" o "Editar tarea" segun modo.
- **Boton X** en esquina superior derecha para cerrar.

```
┌──────────────────────────────────────────┐
│  Crear tarea                       [X]   │
│──────────────────────────────────────────│
│                                          │
│  Titulo *                                │
│  ┌────────────────────────────────────┐  │
│  │                                    │  │
│  └────────────────────────────────────┘  │
│  (mensaje de error si vacio)             │
│                                          │
│  Descripcion                             │
│  ┌────────────────────────────────────┐  │
│  │                                    │  │
│  │                                    │  │
│  └────────────────────────────────────┘  │
│  Necesaria para que la IA pueda estimar  │
│                                          │
│  Estado        (solo en modo edicion)    │
│  ┌──────────┐                            │
│  │ Doing  ▾ │                            │
│  └──────────┘                            │
│                                          │
│  ── Puntuacion ICE (opcional) ────────   │
│                                          │
│  Impact          Confidence              │
│  ┌──────┐        ┌──────┐                │
│  │      │        │      │                │
│  └──────┘        └──────┘                │
│                                          │
│  Ease                                    │
│  ┌──────┐                                │
│  │      │                                │
│  └──────┘                                │
│                                          │
│  Enteros de 0 a 100. Dejar vacio si      │
│  no se quiere definir.                   │
│                                          │
│  ┌────────────┐    ┌─────────────────┐   │
│  │  Cancelar  │    │     Guardar     │   │
│  └────────────┘    └─────────────────┘   │
│                                          │
└──────────────────────────────────────────┘
```

**Comportamiento:**
- En modo creacion: el select de estado no aparece (siempre backlog).
- En modo edicion: todos los campos vienen pre-rellenados.
- Los inputs ICE son `type="number"`, `min=0`, `max=100`, `step=1`.
- Validacion inline: si titulo vacio al guardar, borde rojo + texto de error.

### 4.7 ConfirmModal (generico)

- Mismo estilo de overlay/panel que TaskModal pero mas pequeno (`max-w-sm`).
- Recibe todo por props: titulo, mensaje, etiqueta del boton, variante.

```
┌──────────────────────────────────────┐
│  {titulo}                      [X]   │
│──────────────────────────────────────│
│                                      │
│  {mensaje}                           │
│                                      │
│  ┌────────────┐  ┌────────────────┐  │
│  │  Cancelar  │  │  {confirmar}   │  │
│  └────────────┘  └────────────────┘  │
│                                      │
└──────────────────────────────────────┘
```

- **variant: 'primary'** → boton confirmar azul/indigo.
- **variant: 'destructive'** → boton confirmar rojo.
- Cierra con: Cancelar, X, clic fuera, tecla Escape.

### 4.8 SettingsModal

- Mismo estilo de overlay/panel.
- Contenido especifico para gestionar la API key.

```
┌──────────────────────────────────────────┐
│  Configuracion                     [X]   │
│──────────────────────────────────────────│
│                                          │
│  API Key actual                          │
│  AIza...xF4d                             │
│                                          │
│  Nueva API key                           │
│  ┌────────────────────────────────────┐  │
│  │                                    │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────┐   ┌───────────────────┐  │
│  │  Guardar   │   │  Eliminar key  🗑 │  │
│  └────────────┘   └───────────────────┘  │
│                                          │
└──────────────────────────────────────────┘
```

- "Guardar" actualiza la key y muestra toast exito.
- "Eliminar key" abre un ConfirmModal anidado con variant destructive.
  - Si confirma: borra la key → la app vuelve a mostrar ApiKeySetup.

### 4.9 Toast

- **Posicion**: fijo, esquina superior derecha (`fixed top-4 right-4`).
- **Ancho**: fijo o max-width (`max-w-sm`).
- **Apilamiento**: si hay multiples toasts, se apilan verticalmente con gap.

```
Exito:                              Error:
┌─────────────────────────┐         ┌─────────────────────────┐
│  ✓  ICE calculado    [X]│         │  ⚠  Error al       [X] │
│     correctamente       │         │     calcular ICE:       │
│                         │         │     {mensaje}           │
└─────────────────────────┘         └─────────────────────────┘
bg-green-50, text-green-800         bg-red-50, text-red-800
border-green-200                    border-red-200
auto-dismiss: 3s                    auto-dismiss: 5s
```

### 4.10 IceBadge (subcomponente de TaskCard)

No es un modal ni una pantalla — es una seccion visual dentro de TaskCard.

**Con score calculado:**
```
┌──────────────────────────────────────┐
│                                      │
│  72                                  │
│  ICE Score                           │
│                                      │
│  I: 85       C: 60       E: 70      │
│                                      │
│  Fuente: IA                          │
│  "Alto impacto en UX, confianza      │
│   media por dependencia de terceros" │
│                                      │
└──────────────────────────────────────┘
```

**Sin score (pendiente):**
```
┌──────────────────────────────────────┐
│                                      │
│  Pendiente                           │
│  ICE Score                           │
│                                      │
│  I: --       C: 40       E: --      │
│                                      │
└──────────────────────────────────────┘
```

### 4.11 AiEstimateButton (subcomponente de TaskCard)

Tres estados visuales:

| Estado | Visual | Interaccion |
|--------|--------|-------------|
| Normal | `[Calcular ICE con IA]` azul outline | Click abre ConfirmModal |
| Loading | `[⟳ Calculando...]` gris, disabled | No clickeable |
| Disabled | `[Calcular ICE con IA]` gris opaco | Tooltip al hover |

---

## 5. Estados de la interfaz

### 5.1 Estados de la app

| Estado | Que se renderiza |
|--------|------------------|
| Sin API key | ApiKeySetup (pantalla completa) |
| Con API key, sin tareas | MainView con empty state |
| Con API key, con tareas | MainView con TaskList |

### 5.2 Estados de una TaskCard

| Condicion | Score | Desglose | Fuente | Justificacion |
|-----------|-------|----------|--------|---------------|
| Sin ningun I/C/E | "Pendiente" | I: -- C: -- E: -- | No se muestra | No |
| Parcial (falta alguno) | "Pendiente" | I: 85 C: -- E: 70 | No se muestra | No |
| Completo manual | 72 | I: 85 C: 60 E: 70 | "Manual" | No |
| Completo IA | 72 | I: 85 C: 60 E: 70 | "IA" | Si |

### 5.3 Estados del boton "Calcular ICE con IA"

| Condicion | Estado del boton |
|-----------|-----------------|
| Sin API key | Disabled + tooltip "Configura tu API key" |
| Sin descripcion en la tarea | Disabled + tooltip "Añade una descripcion" |
| Tarea sin ICE previo, lista | Habilitado → ConfirmModal "calcular" |
| Tarea con ICE previo, lista | Habilitado → ConfirmModal "recalcular" |
| Llamada en curso | Loading (spinner + "Calculando...") |

---

## 6. Navegacion y transiciones

No hay router ni navegacion de paginas. Todo se resuelve con:

1. **Renderizado condicional** en `App`: ApiKeySetup vs MainView.
2. **Estado local** para abrir/cerrar modales (`useState<boolean>`).
3. **Props callback** para comunicar acciones (TaskCard → padre → modal).

### Tabla de transiciones

| Desde | Accion del usuario | Hacia |
|-------|--------------------|-------|
| ApiKeySetup | Guarda key | MainView |
| MainView | Click engranaje | SettingsModal (overlay) |
| SettingsModal | Elimina key | ApiKeySetup |
| SettingsModal | Cierra | MainView |
| MainView | Click "+ Nueva tarea" | TaskModal creacion (overlay) |
| TaskModal | Guarda | MainView (tarea nueva en lista) |
| TaskCard | Click "Editar" | TaskModal edicion (overlay) |
| TaskCard | Click "Eliminar" | ConfirmModal (overlay) |
| ConfirmModal | Confirma eliminar | MainView (tarea eliminada) |
| TaskCard | Click "Calcular ICE" | ConfirmModal (overlay) |
| ConfirmModal | Confirma calcular | Loading → Toast → TaskCard actualizada |
| Header | Click "Exportar" | Descarga archivo (sin modal) |
| Header | Click "Importar" | Selector archivo → ConfirmModal → Toast |

---

## 7. Responsive (basico)

No es prioridad, pero se contemplan estos ajustes minimos:

| Breakpoint | Cambio |
|------------|--------|
| >= 768px (md) | Layout por defecto: toolbar en una fila, tarjetas con padding generoso |
| < 768px (sm) | Toolbar hace wrap: boton y buscador en fila 1, selects en fila 2. Tarjetas al 100% de ancho. Modales ocupan casi todo el ancho (mx-4). |
