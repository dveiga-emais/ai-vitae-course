# MVP: Gestor de Tareas Inteligente con modelo ICE

Alcance funcional de un MVP para un curso de React: un gestor de tareas que prioriza usando el modelo ICE (Impact, Confidence, Ease) y puede estimar esos valores automaticamente a partir de la descripcion de la tarea usando Google Gemini API (free tier).

---

## 1. Objetivo del MVP

- Crear, editar y eliminar tareas.
- Asignar prioridad ICE a cada tarea (manual o con IA).
- Calcular automaticamente el ICE score a partir de los tres valores.
- Ordenar y filtrar tareas por prioridad ICE.
- Persistir todo en el navegador (sin backend).

---

## 2. Restricciones del proyecto

| Restriccion               | Detalle                                                    |
| ------------------------- | ---------------------------------------------------------- |
| Framework                 | React (Vite recomendado)                                   |
| Lenguaje                  | JavaScript o TypeScript                                    |
| Backend                   | Ninguno. Todo corre en el navegador                        |
| Persistencia              | `localStorage`                                             |
| Estilos                   | **Tailwind CSS**                                           |
| API de IA                 | Google Gemini API (free tier / developer)                   |
| Gestion de API key        | El usuario la introduce al abrir la app por primera vez. Se guarda en `localStorage`. No se usa `.env` |
| Complejidad de desarrollo | Simple. Pensado para un curso de React                     |

---

## 3. Definicion del modelo ICE

Cada tarea tiene tres variables independientes:

| Variable       | Rango   | Significado                                             |
| -------------- | ------- | ------------------------------------------------------- |
| **Impact**     | 0 - 100 | Impacto esperado si la tarea se completa                |
| **Confidence** | 0 - 100 | Confianza en que la estimacion de impacto es correcta   |
| **Ease**       | 0 - 100 | Facilidad de implementacion (100 = trivial)             |

### Calculo del ICE score

```
ICE = (Impact + Confidence + Ease) / 3
```

- El resultado es un **entero sin decimales** (se redondea con `Math.round`).
- Rango final del score: **0 - 100**.
- Si **cualquiera** de las tres variables no esta definida, el ICE score **no se calcula** y se muestra como **"Pendiente"**.

### Reglas de validacion

- Solo se aceptan numeros enteros entre 0 y 100.
- Los valores fuera de rango se recortan (clamp) a 0..100.
- No se permiten decimales: se redondea cualquier valor recibido.

---

## 4. Alcance funcional

### 4.1 Gestion de API key (onboarding)

**Primera visita (no hay key en localStorage):**

- La app muestra una **pantalla de bienvenida** a pantalla completa (no un alert del sistema) que bloquea el acceso al resto de la app.
- Contenido de la pantalla:
  - Titulo: "Configurar API Key".
  - Breve texto explicativo: "Para usar la estimacion con IA necesitas una API key gratuita de Google Gemini. Puedes obtenerla en Google AI Studio."
  - Link directo a `https://aistudio.google.com/apikey`.
  - Input de texto para pegar la key.
  - Boton "Guardar y continuar" (deshabilitado si el input esta vacio).
- Al guardar: se almacena en `localStorage` con clave `gemini_api_key`.
- La app navega a la vista principal.

**Visitas posteriores (hay key en localStorage):**

- La pantalla de onboarding no aparece.
- La app carga directamente la vista principal.

**Cambiar o borrar la key:**

- En el header de la app: icono/boton de configuracion (engranaje).
- Abre un modal con:
  - El valor actual de la key (parcialmente enmascarado: `AIza...xF4d`).
  - Input para cambiarla.
  - Boton "Guardar".
  - Boton "Eliminar key" (con confirmacion via modal).

### 4.2 CRUD de tareas

**Crear tarea:**

- Titulo (obligatorio).
- Descripcion (opcional, pero necesaria para que la IA pueda estimar ICE).
- Estado inicial: `backlog`.
- Fecha de creacion: automatica.
- I/C/E: sin definir por defecto.

**Editar tarea:**

- Se puede modificar: titulo, descripcion, estado, y valores I/C/E de forma manual.
- UX: se abre un modal con el formulario pre-rellenado.
- Al pulsar "Guardar" se aplican los cambios. No se requiere confirmacion extra (el modal ya actua como paso intermedio).

**Eliminar tarea:**

- **Confirmacion obligatoria** mediante un **modal de confirmacion** (componente propio con Tailwind, no `window.confirm`).
- El modal muestra:
  - Titulo: "Eliminar tarea".
  - Texto: "¿Seguro que quieres eliminar «{titulo de la tarea}»? Esta accion no se puede deshacer."
  - Boton "Cancelar" (secundario).
  - Boton "Eliminar" (rojo/destructivo).

**Cambiar estado:**

- Tres estados posibles: `backlog`, `doing`, `done`.
- Se cambia desde un selector (`<select>`) en la tarjeta o en el modal de edicion.
- Sin confirmacion (es una accion rapida y reversible).

### 4.3 Priorizacion y visualizacion ICE

**En la lista de tareas, cada tarjeta muestra:**

- Titulo.
- Estado (badge de color con Tailwind).
- ICE score (numero grande) o el texto **"Pendiente"** si falta alguna variable.
- Desglose I / C / E debajo del score, cada uno con su valor o **"–"** si no esta definido.

**Ordenacion:**

- Por ICE score descendente (por defecto). Las tareas con ICE "Pendiente" van al final.
- Por fecha de creacion (mas reciente primero).
- Por titulo (A-Z).

**Filtros:**

- Por estado: `Todos | Backlog | Doing | Done`.
- Busqueda por texto (filtra por titulo y descripcion).

### 4.4 Estimacion ICE con Google Gemini

**Flujo:**

1. En cada tarjeta de tarea: boton **"Calcular ICE con IA"**.
2. **Confirmacion antes de llamar** mediante **modal de confirmacion**:
   - Si la tarea NO tiene valores I/C/E:
     - Titulo: "Calcular ICE con IA".
     - Texto: "¿Quieres que la IA estime el ICE para esta tarea?".
   - Si la tarea YA tiene valores I/C/E:
     - Titulo: "Recalcular ICE con IA".
     - Texto: "Esta tarea ya tiene valores ICE. ¿Quieres sobreescribirlos con la estimacion de la IA?".
   - Botones: "Cancelar" (secundario) / "Calcular" (primario).
3. Si acepta:
   - El boton pasa a estado loading (spinner + texto "Calculando..." y deshabilitado).
   - Se hace la peticion a Gemini API.
   - Si la respuesta es correcta: se guardan I, C, E y la justificacion en la tarea. Se muestra un **toast de exito** ("ICE calculado correctamente") que desaparece automaticamente en 3 segundos.
   - Si la peticion falla: se muestra un **toast de error** ("Error al calcular ICE: [mensaje]") que desaparece automaticamente en 5 segundos. No se modifican los valores existentes.
4. Si cancela: no pasa nada.

**Requisitos para el boton:**

- Si la tarea no tiene descripcion, el boton esta **deshabilitado** con un tooltip: "Añade una descripcion para poder estimar con IA".
- Si no hay API key en localStorage, el boton esta **deshabilitado** con tooltip: "Configura tu API key primero".

### 4.5 Persistencia local

- Las tareas se guardan en `localStorage` automaticamente en cada cambio.
- Al cargar la app se recuperan las tareas guardadas.
- **Exportar JSON**: boton que descarga un archivo `.json` con todas las tareas.
- **Importar JSON**: boton que permite seleccionar un archivo `.json` y cargar las tareas.
  - **Confirmacion** mediante **modal de confirmacion**:
    - Titulo: "Importar tareas".
    - Texto: "Esto reemplazara todas las tareas actuales. ¿Quieres continuar?".
    - Botones: "Cancelar" / "Importar".

---

## 5. Fuera de alcance

- Autenticacion, usuarios, permisos o roles.
- Backend, base de datos, sincronizacion multi-dispositivo.
- Colaboracion en tiempo real.
- Notificaciones push, calendarios, dependencias entre tareas.
- Adjuntos, archivos, comentarios.
- Tags o categorias.
- Drag & drop para reordenar.
- Variables de entorno (`.env`) para la API key.

---

## 6. Propuesta de UX

### 6.1 Pantalla de onboarding (API key)

Se muestra solo si no hay key guardada en `localStorage`. Bloquea el acceso al resto de la app.

```
+----------------------------------------------------------+
|                                                          |
|              Gestor de Tareas ICE                        |
|                                                          |
|          Configurar API Key de Gemini                    |
|                                                          |
|  Para usar la estimacion con IA, necesitas una API key   |
|  gratuita de Google Gemini.                              |
|                                                          |
|  > Obtener API key en Google AI Studio                   |
|                                                          |
|  API Key                                                 |
|  [____________________________________]                  |
|                                                          |
|              [Guardar y continuar]                        |
|                                                          |
+----------------------------------------------------------+
```

### 6.2 Layout principal

```
+----------------------------------------------------------+
|  HEADER                                                  |
|  [Logo/Titulo]            [Exportar] [Importar] [Conf.]  |
+----------------------------------------------------------+
|  TOOLBAR                                                 |
|  [+ Nueva tarea]  [Buscar...]  [Estado: v]  [Orden: v]  |
+----------------------------------------------------------+
|  LISTA DE TAREAS                                         |
|                                                          |
|  +----------------------------------------------------+  |
|  | Titulo de la tarea                     [Doing v]   |  |
|  | ICE: 72          I: 85  C: 60  E: 70              |  |
|  | Fuente: IA                                         |  |
|  | "Justificacion de la IA..."                        |  |
|  | [Calcular ICE con IA]  [Editar]  [Eliminar]       |  |
|  +----------------------------------------------------+  |
|                                                          |
|  +----------------------------------------------------+  |
|  | Otra tarea                            [Backlog v]  |  |
|  | ICE: Pendiente    I: --  C: 40  E: --             |  |
|  | [Calcular ICE con IA]  [Editar]  [Eliminar]       |  |
|  +----------------------------------------------------+  |
|                                                          |
+----------------------------------------------------------+
```

### 6.3 Modal de creacion / edicion

Overlay con fondo oscuro semitransparente. Panel centrado con bordes redondeados (Tailwind: `rounded-lg shadow-xl`).

```
+------------------------------------------+
|  Crear tarea  /  Editar tarea      [X]   |
|------------------------------------------|
|  Titulo *                                |
|  [________________________]              |
|                                          |
|  Descripcion                             |
|  [________________________]              |
|  [________________________]              |
|                                          |
|  Estado                                  |
|  [Backlog v]                             |
|                                          |
|  --- Puntuacion ICE (opcional) ---       |
|  Impact [___]  Confidence [___]          |
|  Ease   [___]                            |
|  (Enteros de 0 a 100, dejar vacio       |
|   si no se quiere definir)               |
|                                          |
|  [Cancelar]              [Guardar]       |
+------------------------------------------+
```

### 6.4 Modal de confirmacion (reutilizable)

Componente generico `ConfirmModal` que recibe titulo, mensaje y texto de los botones. Se usa para: eliminar tarea, calcular ICE con IA, importar JSON, eliminar API key.

```
+------------------------------------------+
|  {titulo}                          [X]   |
|------------------------------------------|
|                                          |
|  {mensaje}                               |
|                                          |
|  [Cancelar]        [{textoConfirmar}]    |
+------------------------------------------+
```

- Boton de confirmar: estilo primario por defecto, estilo destructivo (rojo) para eliminaciones.
- Cierra al pulsar "Cancelar", la X, o hacer clic fuera del modal.

### 6.5 Toast de notificacion

Aparece en la esquina superior derecha. Desaparece automaticamente.

```
+-----------------------------------+
|  [icono] {mensaje}          [X]   |
+-----------------------------------+
```

- **Exito**: fondo verde claro, icono check (Tailwind: `bg-green-50 text-green-800`).
- **Error**: fondo rojo claro, icono alerta (Tailwind: `bg-red-50 text-red-800`).
- Duracion: 3s para exito, 5s para error.
- Se puede cerrar manualmente con la X.

### 6.6 Tarjeta de tarea

**Con ICE calculado:**

```
+------------------------------------------------------+
|  Implementar login con OAuth            [Doing v]    |
|------------------------------------------------------|
|                                                      |
|   72                                                 |
|   ICE Score                                          |
|                                                      |
|   I: 85       C: 60       E: 70                     |
|                                                      |
|   Fuente: IA                                         |
|   "Alto impacto en UX, confianza media por           |
|    dependencia de terceros, facilidad moderada."     |
|                                                      |
|------------------------------------------------------|
|  [Calcular ICE con IA]    [Editar]    [Eliminar]     |
+------------------------------------------------------+
```

**Con ICE pendiente:**

```
+------------------------------------------------------+
|  Revisar documentacion                  [Backlog v]  |
|------------------------------------------------------|
|                                                      |
|   Pendiente                                          |
|   ICE Score                                          |
|                                                      |
|   I: --       C: 40       E: --                     |
|                                                      |
|------------------------------------------------------|
|  [Calcular ICE con IA]    [Editar]    [Eliminar]     |
+------------------------------------------------------+
```

### 6.7 Resumen de confirmaciones y notificaciones

| Accion                        | Componente        | Contenido                                                                       |
| ----------------------------- | ----------------- | ------------------------------------------------------------------------------- |
| Eliminar tarea                | `ConfirmModal`    | "¿Seguro que quieres eliminar «{titulo}»? Esta accion no se puede deshacer."   |
| Calcular ICE con IA           | `ConfirmModal`    | "¿Quieres que la IA estime el ICE para esta tarea?"                             |
| Recalcular ICE (ya tiene)     | `ConfirmModal`    | "Esta tarea ya tiene valores ICE. ¿Quieres sobreescribirlos con la IA?"         |
| Importar JSON                 | `ConfirmModal`    | "Esto reemplazara todas las tareas actuales. ¿Quieres continuar?"               |
| Eliminar API key              | `ConfirmModal`    | "Si eliminas la API key tendras que volver a introducirla. ¿Continuar?"         |
| ICE calculado con exito       | `Toast` (exito)   | "ICE calculado correctamente"                                                   |
| Error de API                  | `Toast` (error)   | "Error al calcular ICE: {mensaje del error}"                                    |
| Tareas importadas             | `Toast` (exito)   | "Tareas importadas correctamente"                                               |
| Error al importar             | `Toast` (error)   | "Error al importar: {mensaje}"                                                  |
| API key guardada              | `Toast` (exito)   | "API key guardada"                                                              |

No se usa `window.alert`, `window.confirm` ni `window.prompt` en ningun punto de la app.

---

## 7. Modelo de datos

```ts
type TaskStatus = 'backlog' | 'doing' | 'done'

type IceScore = {
  impact?: number       // 0..100, entero. undefined = sin definir
  confidence?: number   // 0..100, entero. undefined = sin definir
  ease?: number         // 0..100, entero. undefined = sin definir
  score?: number        // Media de I+C+E, entero. undefined si falta alguno
  rationale?: string    // Justificacion de la IA (1-2 frases)
  source?: 'manual' | 'ai'
}

type Task = {
  id: string            // crypto.randomUUID() o similar
  title: string
  description?: string
  status: TaskStatus
  createdAt: string     // ISO 8601
  updatedAt: string     // ISO 8601
  ice: IceScore
}
```

### Claves de localStorage

| Clave             | Contenido                        |
| ----------------- | -------------------------------- |
| `gemini_api_key`  | String con la API key            |
| `tasks`           | JSON stringificado de `Task[]`   |

### Funcion de calculo

```ts
function calculateIceScore(i?: number, c?: number, e?: number): number | undefined {
  if (i === undefined || c === undefined || e === undefined) return undefined
  return Math.round((i + c + e) / 3)
}
```

---

## 8. Integracion con Google Gemini API

### 8.1 Configuracion

- API: **Google Gemini API** (free tier / Google AI Studio).
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={API_KEY}`
- API key: leida de `localStorage` (clave `gemini_api_key`). Introducida por el usuario en el onboarding o en la pantalla de configuracion.
- Modelo recomendado: `gemini-2.0-flash` (rapido, disponible en free tier).
- Limite free tier: 15 RPM / 1M TPM (suficiente para un curso).

### 8.2 Prompt

```
Eres un asistente de priorizacion de tareas usando el modelo ICE.
Evalua la siguiente tarea y devuelve UNICAMENTE un JSON valido (sin markdown, sin texto extra) con este esquema exacto:

{
  "impact": <entero 0-100>,
  "confidence": <entero 0-100>,
  "ease": <entero 0-100>,
  "rationale": "<1-2 frases justificando la puntuacion>"
}

Criterios:
- impact: cuanto valor aporta completar esta tarea (0=ninguno, 100=critico).
- confidence: cuanta certeza hay en la estimacion (0=pura especulacion, 100=certeza total).
- ease: cuanto de facil es implementarla (0=extremadamente dificil, 100=trivial).
- Los tres valores deben ser enteros, sin decimales.

Tarea:
Titulo: {title}
Descripcion: {description}
```

### 8.3 Validacion de la respuesta

1. Intentar `JSON.parse` de la respuesta.
2. Si falla, intentar extraer el primer bloque `{...}` del texto y parsearlo.
3. Validar que `impact`, `confidence` y `ease` sean numeros.
4. Redondear con `Math.round` y clampar a 0..100.
5. Calcular `score = Math.round((impact + confidence + ease) / 3)`.
6. Si cualquier paso falla: mostrar toast de error "Error al calcular ICE: respuesta de la IA no valida". No se modifican valores existentes.

### 8.4 Gestion de errores

Cualquier error en la llamada (red, HTTP != 200, timeout, respuesta no parseable) se gestiona asi:

- Se muestra un **toast de error** con el mensaje descriptivo.
- El boton vuelve a su estado normal.
- Los valores I/C/E existentes no se tocan.
- No hay reintentos automaticos. El usuario puede volver a pulsar el boton.

---

## 9. Criterios de aceptacion

### API key

- [ ] Al abrir la app por primera vez veo la pantalla de onboarding para introducir la API key.
- [ ] Tras guardar la key, la app me lleva a la vista principal.
- [ ] En visitas posteriores no se me vuelve a pedir la key.
- [ ] Puedo cambiar o eliminar la key desde el boton de configuracion en el header.
- [ ] Si elimino la key, al recargar vuelve a aparecer el onboarding.

### Tareas

- [ ] Puedo crear una tarea con titulo (la descripcion es opcional).
- [ ] Puedo editar una tarea existente (titulo, descripcion, estado, I/C/E).
- [ ] Al eliminar una tarea, se me pide confirmacion en un modal.
- [ ] Una tarea nueva aparece con ICE "Pendiente".
- [ ] Puedo asignar I/C/E manualmente (0-100, enteros) y el score se calcula.
- [ ] Si dejo alguna variable I/C/E vacia, el score muestra "Pendiente".

### IA

- [ ] Al pulsar "Calcular ICE con IA" se me pide confirmacion en un modal.
- [ ] Si la tarea no tiene descripcion, el boton de IA esta deshabilitado.
- [ ] Si no hay API key guardada, el boton de IA esta deshabilitado.
- [ ] Si la API falla, veo un toast de error y los valores no cambian.
- [ ] Si la API responde bien, los valores I/C/E y la justificacion se guardan y veo un toast de exito.

### Listado y filtros

- [ ] La lista se ordena por ICE descendente por defecto (pendientes al final).
- [ ] Puedo filtrar por estado y buscar por texto.

### Persistencia

- [ ] Al recargar la pagina, mis tareas siguen ahi (localStorage).
- [ ] Puedo exportar e importar tareas como JSON.
- [ ] Al importar, se me pide confirmacion de sobreescritura en un modal.

### UI general

- [ ] Toda la interfaz esta estilizada con Tailwind CSS.
- [ ] No se usa `window.alert`, `window.confirm` ni `window.prompt` en ningun punto.
- [ ] Las confirmaciones se hacen con modales custom.
- [ ] Los mensajes de exito/error se muestran con toasts.

---

## 10. Alcance tecnico

### Estado y persistencia

- Estado global: `useReducer` + `useContext`, o un store ligero (Zustand).
- Persistencia: hook custom `useLocalStorageState` que sincroniza estado con `localStorage`.
- Llamada a Gemini: `fetch` nativo (sin librerias HTTP extra).

### Componentes sugeridos

| Componente         | Responsabilidad                                                 |
| ------------------ | --------------------------------------------------------------- |
| `App`              | Layout, providers, logica de onboarding vs vista principal      |
| `ApiKeySetup`      | Pantalla de onboarding para introducir la API key               |
| `Header`           | Titulo, botones exportar/importar, boton configuracion          |
| `Toolbar`          | Boton nueva tarea, buscador, filtro estado, selector orden      |
| `TaskList`         | Renderiza la lista filtrada y ordenada                          |
| `TaskCard`         | Muestra una tarea con su ICE, acciones                          |
| `TaskModal`        | Modal para crear/editar tarea                                   |
| `IceBadge`         | Muestra el score (numero o "Pendiente") y desglose I/C/E       |
| `AiEstimateButton` | Boton con logica de confirmacion, loading y llamada a API       |
| `ConfirmModal`     | Modal generico reutilizable para confirmaciones                 |
| `Toast`            | Notificacion temporal (exito/error) esquina superior derecha    |
| `SettingsModal`    | Modal para ver/cambiar/eliminar la API key                      |

### Estilos

- **Tailwind CSS** como unica solucion de estilos.
- Clases utilitarias directamente en JSX.
- Responsive basico (que se vea razonable en movil, sin ser prioridad).

---

## 11. Entregables del MVP

- App React ejecutable con `npm run dev`.
- Tailwind CSS configurado.
- README con:
  - Como instalar y ejecutar.
  - Como obtener una API key gratuita de Google AI Studio.
  - Explicacion de que la key se introduce en la app y se guarda en localStorage.
  - Limitaciones conocidas (key en localStorage del navegador, limites del free tier).
