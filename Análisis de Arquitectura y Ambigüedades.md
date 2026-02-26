Análisis de Arquitectura: Ambigüedades, Riesgos y Exceso de Alcance
He revisado la especificación del MVP. Aquí está mi análisis detallado:
---
❌ RIESGOS CRÍTICOS
1. Seguridad: API Keys expuestas en el cliente (línea 19)
- Riesgo: Las API keys en el navegador son completamente accesibles. Cualquiera puede extraerlas y abusar del free tier.
- Impacto: Cuota agotada, bloqueo de cuenta, potencial abuso.
- Recomendación: Aunque se menciona en la nota, para un curso esto enseña malas prácticas. Considerar:
  - Usar un proxy serverless mínimo (Vercel/Netlify functions)
  - O limitar estrictamente el alcance educativo con advertencias claras
2. Dependencia de APIs de terceros sin fallback robusto (línea 179-182)
- Riesgo: Si la API gratuita cambia términos, límites o formato, la funcionalidad core se rompe.
- Ambigüedad: "Modo fallback" está marcado como opcional pero es crítico para la UX.
- Recomendación: Hacer el modo manual OBLIGATORIO, IA como enhancement opcional.
3. Validación de JSON de la IA insuficientemente especificada (línea 170-175)
- Ambigüedad: "intentar extraer el primer objeto JSON" es vago.
- Riesgo: Diferentes LLMs tienen comportamientos distintos (markdown wrapping, texto adicional).
- Recomendación: Especificar estrategias exactas:
  - Regex para extraer {...} de bloques markdown
  - Timeouts explícitos
  - Manejo de respuestas truncadas
---
⚠️ AMBIGÜEDADES TÉCNICAS
4. Modelo de datos inconsistente (línea 107-132)
ice: IceScore  // ¿Puede ser undefined/null inicialmente?
- Ambigüedad: ¿ice es siempre un objeto o puede ser undefined? El tipo no lo refleja.
- Impacto: Errores en runtime al acceder task.ice?.score.
- Recomendación: Definir explícitamente:
ice: IceScore | null
// O hacer todos los campos de IceScore opcionales desde el inicio
5. Reglas de cálculo ICE ambiguas (línea 26, 31)
- Contradicción:
  - Línea 26: ICE = I * C * E (rango 1..1000)
  - Línea 31: "Si falta algún valor, ICE pendiente"
- Ambigüedad: ¿Qué pasa si I=1, C=undefined, E=10? ¿Se calcula parcialmente? ¿Se muestra "pendiente"?
- Recomendación: Especificar: "ICE solo se calcula si los 3 valores están presentes"
6. "Confirmación simple" para eliminar (línea 44)
- Ambigüedad: ¿Window.confirm()? ¿Modal custom? ¿Undo toast?
- Recomendación: Especificar UX exacto (importante para curso React).
7. Filtros y búsqueda sin especificar comportamiento (línea 72-75)
- Ambigüedad:
  - ¿Búsqueda case-insensitive?
  - ¿Se pueden combinar filtro + búsqueda?
  - ¿Buscar en tags también?
- Recomendación: Definir casos de interacción:
  - "Filtro estado + búsqueda = AND lógico"
  - "Búsqueda en título, descripción Y tags"
---
🔴 EXCESO DE ALCANCE PARA UN MVP
8. Features marcadas como "opcional" que desvían foco (línea 70, 80, 101-105)
- Exceso:
  - "Selector de tipo de tarea" (línea 70): Añade complejidad UI y prompts
  - Rutas opcionales (línea 101-105): No aporta valor didáctico si la SPA funciona
  - Import/Export JSON (línea 80): Nice-to-have, no core del ICE
- Riesgo: Los alumnos pierden tiempo en features secundarias.
- Recomendación: Mover a "Fase 2" post-MVP:
  - Import/Export → útil pero no crítico
  - Rutas → solo si el curso es sobre React Router
9. Edición de estado en múltiples lugares (línea 43, 54)
- Exceso:
  - Editar estado en el form (línea 43)
  - Mostrar estado en la lista (línea 54)
- Ambigüedad: ¿Cambio de estado inline en cards? ¿Solo en modal?
- Recomendación: Simplificar a cambio inline tipo Trello (dropdown) SOLO en cards.
10. Tags como string separado por comas (línea 41)
- Riesgo: Parsing manual propenso a errores ("tag1, tag2 , tag3  ").
- Exceso: Los tags no aportan al core ICE en MVP.
- Recomendación:
  - REMOVER tags del MVP, o
  - Guardar como string[] directamente en el form (no parsear comas)
---
📋 AMBIGÜEDADES DE ALCANCE
11. "Ordenable por ICE/fecha/título" (línea 48-51)
- Ambigüedad: ¿UI con 3 botones? ¿Dropdown? ¿Toggle ASC/DESC?
- Exceso: 3 opciones de sort en MVP es mucho.
- Recomendación: Solo ICE DESC + toggle para ASC. Fecha/título para v2.
12. "Indicador de sin scoring" (línea 56)
- Ambigüedad: ¿Badge con "N/A"? ¿Ícono? ¿Texto?
- Recomendación: Especificar visualmente (mockup o ejemplo).
13. "Reintentar" en errores de IA (línea 68)
- Ambigüedad: ¿Botón "Reintentar" inline? ¿Mismo botón cambia a "Reintentar"?
- Riesgo: Los alumnos implementan lógica de retry automático (overengineering).
- Recomendación: "Mismo botón, al fallar muestra error + permite re-clic".
---
🧪 FALTA DE DEFINICIÓN TÉCNICA
14. "useReducer o store pequeño" (línea 195)
- Ambigüedad: Dos opciones diferentes dificultan la guía del curso.
- Recomendación: Elegir UNA aproximación para el curso:
  - Context + useReducer (más React "puro")
  - Zustand (más real-world, menos boilerplate)
15. "Estilos: CSS modules o CSS simple" (línea 198)
- Ambigüedad: Sin estándar, cada alumno usa algo diferente (dificulta ayuda).
- Recomendación: Definir uno según el objetivo del curso.
16. Persistencia: "un hook useLocalStorageState" (línea 196)
- Ambigüedad: ¿Los alumnos lo implementan o usan librería como usehooks-ts?
- Recomendación: Especificar si es ejercicio educativo o usar librería.
---
✅ RECOMENDACIONES PRIORIZADAS
| Prioridad | Acción | Líneas afectadas |
|-----------|--------|------------------|
| P0 | Definir fallback manual como OBLIGATORIO | 179-182 |
| P0 | Aclarar tipo ice: IceScore \| null | 112-120 |
| P0 | Especificar regla: ICE solo si I, C, E presentes | 26, 31 |
| P1 | Remover tags del MVP o simplificar | 41, 107 |
| P1 | Reducir ordenamiento a solo ICE DESC/ASC | 48-51 |
| P1 | Mover Import/Export a Fase 2 | 80 |
| P1 | Elegir UNA solución de estado | 195 |
| P2 | Especificar UX de confirmación de borrado | 44 |
| P2 | Documentar estrategia de parsing JSON IA | 170-175 |
| P2 | Definir comportamiento filtros combinados | 72-75 |
---
🎯 MVP REDUCIDO SUGERIDO (Core Features Only)
1. ✅ CRUD básico (sin tags)
2. ✅ Edición manual de I/C/E
3. ✅ Cálculo ICE (solo si I, C, E presentes)
4. ✅ Lista ordenada por ICE DESC
5. ✅ Botón IA (con fallback manual siempre disponible)
6. ✅ Persistencia localStorage
7. ❌ Tags → Fase 2
8. ❌ Import/Export → Fase 2
9. ❌ Ordenamiento múltiple → Fase 2
10. ❌ Rutas → Fase 2
Esta reducción mantiene el valor educativo del ICE + IA sin sobrecargar al alumno.
