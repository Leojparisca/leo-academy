# Concept Brief: Estabilización de Sincronización, Latencia Móvil y Desbloqueo de Currículo

**Proyecto:** Leo Academy  
**Metodología:** Elephant-Goldfish Model (EGM)  
**Fecha:** 2026-11-13  
**Estado:** Auditado y resuelto. Pendiente de aprobación explícita para implementar en `src/`.

## 1. Problema y Objetivos (El Elefante)

Alumnos reales (edades de 12 a 64 años) reportan tres fallos críticos en producción que bloquean su aprendizaje y destruyen la confianza en la plataforma:

1. **Pérdida de progreso al cambiar de dispositivo:** Al iniciar sesión con su código en otro teléfono o navegador, el progreso, XP y lecciones completadas no aparecen.
2. **Desfase audio-táctil en móviles:** En el ejercicio rítmico (`rhythm-call-response.tsx`), los toques en pantalla móvil sufren retraso respecto al pulso sonoro, penalizando injustamente al alumno.

   **Diagnóstico:** el juicio compara el toque contra `AudioContext.currentTime`, el reloj de envío al render, no el de salida física. El sesgo es siempre en la misma dirección (salida + entrada táctil) y por eso una ventana simétrica de ±150 ms pierde su mitad útil. Presupuesto a batir: sesgo residual ≤ 60 ms tras compensación en iPhone con cable y Android de gama media con cable; ≤ 120 ms con Bluetooth, o aviso explícito al alumno de que use cable para las lecciones rítmicas.

   El alcance incluye `src/components/curriculum/lesson-runner.tsx`: `PulseFeel` agenda sus ocho pulsos sin `when` y los dispara simultáneamente. Cualquier trabajo de latencia debe arreglar también ese ejercicio, o el alumno oirá un solo golpe donde debería oír ocho.

3. **Niveles bloqueados tras completar requisitos:** Nodos del mapa curricular permanecen con candado a pesar de haber finalizado las lecciones previas.

   El desbloqueo no está roto: `unlockedLevel` exige las tres ramas del umbral anterior y ya lo hace bien. Lo que falta es que `curriculum_progress` llegue al dispositivo. Y `getCurriculumNode` debe dejar de devolver el nodo 0 ante un ID desconocido: un nodo inexistente tiene que fallar de forma visible, no atribuir el avance al primer nodo.

### Restricciones Innegociables

- **Cero pérdida de datos:** Bajo ninguna circunstancia se deben borrar, resetear o sobrescribir con ceros los registros existentes de alumnos en Turso (SQLite).

  **Invariante de sincronización:** una fila local solo puede marcarse como sincronizada si viajó efectivamente en el dump enviado y el servidor la aceptó. El resultado del respaldo (`skipped`) es la única fuente de verdad para decidir qué se borra de la cola; ninguna fila `skipped` puede eliminarse ni marcarse como sincronizada, y ninguna fila creada durante el envío puede contar como enviada.

  **Límites del respaldo:** el dump está acotado por tabla y conserva solo lo más nuevo. Al alcanzar el techo, el respaldo omite historia en silencio. Cualquier diseño que dependa de él debe declarar el techo, el criterio de descarte y el aviso visible al profesor cuando se alcanza.

- **Sin Design Theater:** Toda operación de red o sincronización debe mostrar estado explícito al usuario ("Sincronizando progreso..."), con recuperación limpia ante fallos de red. Los estados, el copy exacto y las acciones disponibles se fijan en §7.

## 2. Lentes de Auditoría para los Peces Dorados (Goldfish Reviewers)

Antes de implementar, los subagentes aislados deben atacar este plan buscando:

1. **Pez 1 (Auditor de Datos y Concurrencia):** ¿Qué pasa si un alumno abre dos pestañas o juega offline en el teléfono A y luego entra en el teléfono B? ¿Puede el Merge borrar XP real?
2. **Pez 2 (Ingeniero de Web Audio y Móvil):** ¿Qué ocurre en Safari iOS donde `outputLatency` puede ser `undefined` o `0`? ¿Se desbloquea el `AudioContext` correctamente tras el primer toque?
3. **Pez 3 (Alumno de 64 años en Celular):** ¿El flujo de sincronización y calibración se entiende sin palabras técnicas? ¿Qué pasa si falla el Wi-Fi justo al terminar una lección?

## 3. Contexto Operativo Conocido

- La academia es una PWA Next.js con Dexie (IndexedDB) como caché y outbox del dispositivo, y Turso (SQLite) como almacén del servidor. **Hoy Turso es fuente de verdad solo de `students`, `practice_sessions`, `lesson_progress` y `skill_scores` (estas dos últimas, únicamente vía acciones autenticadas del alumno). `curriculum_progress` y `xp_ledger` solo se escriben en Turso cuando un profesor ejecuta `syncBackupAction`; hasta entonces viven solo en el Dexie del dispositivo que los generó.**
- El acceso del alumno es por nombre + código de 4 caracteres (el servidor acepta hasta 8, la interfaz solo captura 4); la sesión es una cookie HMAC (`leo_student`) de 30 días.
- El profesor respalda el dispositivo con `syncBackupAction`, que exige sesión de profesor y hace un merge por `max()`/`onConflictDoNothing`.
- **Escritor canónico por evento:** un resultado de ejercicio lo escribe un solo camino. Hoy el mismo evento puede insertar `sess_<clientId>` (`students.ts`), `live_<clientId>` (`live.ts`) y `score_<sha1>` (`sync.ts`) con tres IDs distintos; mientras eso siga así, `onConflictDoNothing` no aporta idempotencia y la precisión del alumno se infla.
- **Identidad de fila:** el ID estable no puede depender del reloj del dispositivo. Un `createdAt` adelantado o una zona horaria distinta generan IDs distintos para el mismo hecho y duplican XP y puntuaciones. La idempotencia exige una clave de contenido (`alumno + tipo + origen + referencia`) o un ID asignado en el servidor. El merge de métricas debe ser monótono: en empate de minutos, gana la precisión mayor, nunca la del último dispositivo que respaldó.
- El ejercicio rítmico juzga cada toque contra el reloj de `AudioContext.currentTime` con una tolerancia de ±150 ms.
- El mapa curricular desbloquea un umbral cuando las tres ramas del umbral anterior están selladas en Dexie, o cuando el profesor sube `currentLevel`.
- **Instrumentación ausente:** el motor no expone `baseLatency` ni `outputLatency`, `now()` devuelve `0` cuando no hay contexto y el analizador está antes del nodo de salida, por lo que el interruptor de silencio del iPhone no se detecta. Sin instrumentación, la calibración del criterio 2 de §9 no es medible.

## 4. Alternativas consideradas

- **Alternativa A — lectura de progreso por alumno (elegida).** Una acción autenticada devuelve el paquete completo (perfil, lecciones, currículo, puntuaciones y XP) en una sola llamada y el provider hidrata Dexie antes del primer render del mapa. Coste: una ruta nueva y latencia de carga inicial. Beneficio: cumple el criterio de "sin intervención del profesor" en cualquier dispositivo.
- **Alternativa B — restaurar desde el respaldo del profesor.** Rechazada: depende de que el profesor esté presente en el momento del cambio de dispositivo, lo que viola el criterio 1 de §9, y el dump está acotado por `BACKUP_LIMITS`, así que la restauración sería parcial por diseño.
- **Alternativa C — mover el progreso a un servicio externo.** Rechazada por coste operativo, por añadir una segunda fuente de verdad y por duplicar datos que ya existen en Turso.

## 5. No-objetivos

- Rediseño visual del mapa curricular.
- Cambio del modelo pedagógico o de la estructura de lecciones.
- Migración o reescritura de datos históricos ya existentes.
- Sincronización multijugador o en tiempo real entre dispositivos.
- Sustituir Dexie por otra capa de almacenamiento local.

## 6. Riesgos y límites

| Riesgo | Impacto | Mitigación exigida |
| --- | --- | --- |
| Doble conteo de `skill_scores` | Precisión y XP inflados | Escritor canónico por evento (§3) |
| Truncado silencioso de `BACKUP_LIMITS` | Pérdida de historia sin aviso | Aviso visible al profesor (§1) |
| Latencia de Bluetooth no compensable | Alumno penalizado por su hardware | Umbral declarado y aviso de cable (§1.2) |
| Relojes de dispositivo desfasados | IDs duplicados y filas repetidas | Clave de contenido o ID de servidor (§3) |
| Pérdida de sesión al cambiar de red | Alumno expulsado a mitad de lección | La sesión es cookie HMAC de 30 días; no se destruye por fallo de red |
| Fallo de red durante el respaldo | Filas marcadas como enviadas sin serlo | Invariante de sincronización (§1) |

## 7. Estados visibles y copy obligatorio

| Estado | Texto exacto | Dónde | Acción disponible |
| --- | --- | --- | --- |
| Leyendo del servidor | "Buscando tu progreso…" | cabecera + mapa | ninguna (spinner) |
| Sincronizado y verificado | "Todo guardado" | cabecera | ninguna |
| Guardado solo en este teléfono | "Guardado aquí. Se enviará cuando vuelva el internet." | cabecera + toast al terminar lección | "Reintentar ahora" |
| Fallo al leer | "No pudimos traer tu progreso. Tus datos siguen aquí." | mapa | "Reintentar" / "Seguir practicando" |
| Conflicto entre dos teléfonos | "Este teléfono tenía avance más antiguo. Conservamos el más avanzado." | toast | "Entendido" |

Reglas:

- El texto del estado es visible a 320 px de ancho; un punto de color no es un estado.
- Nunca se usa "Sincronizado" si solo se leyó el perfil.
- Ningún estado nombra Dexie, Turso, caché, merge ni servidor.

## 8. Verificación

Sin runner de pruebas en el repositorio, la matriz es manual y debe quedar registrada:

| Caso | Qué se comprueba |
| --- | --- |
| iPhone Safari con cable | Acierto rítmico dentro del umbral de §1.2 |
| iPhone Safari con Bluetooth | Sesgo residual y aviso de cable si aplica |
| Android gama media Chrome con cable | Acierto rítmico dentro del umbral |
| Android + Bluetooth | Comportamiento degradado declarado |
| Ancho de 320 px | El texto de estado es legible y veraz (§7) |
| Dispositivo limpio | El progreso aparece tras login sin intervención del profesor |
| Red cortada al terminar una lección | Nada se marca como enviado; el alumno ve el estado correcto |

## 9. Criterios de Éxito Propuestos

1. Un alumno que entra con su código en un dispositivo nuevo ve su progreso, XP y lecciones completadas en menos de 5 segundos, sin intervención del profesor.

   **Alcance implícito:** este criterio exige una ruta de lectura que hoy no existe. Requiere una acción autenticada del alumno que devuelva, en una sola llamada, su fila de `students` más `lesson_progress`, `curriculum_progress`, `skill_scores` y el saldo de `xp_ledger` de ese alumno, y una hidratación de Dexie en `AcademyProvider` antes del primer render del mapa. Sin esa pieza, los criterios 1 y 3 son inalcanzables.

2. Un toque percibido como "a tiempo" en un iPhone o Android de gama media se juzga como acierto, incluso con auriculares Bluetooth.

   **Decisión requerida:** compensar el sesgo con un desplazamiento por dispositivo (calibración de 4 toques guiados, guardada en `localStorage`) más la latencia declarada por el navegador cuando exista y sea > 0; si no existe, aplicar el desplazamiento calibrado y una ventana asimétrica (más margen en el lado tardío). Si la calibración no converge en 4 intentos, el ejercicio se degrada a "modo práctica" sin nota y lo dice en pantalla. El brief fija el valor residual objetivo en §1.2, no solo el síntoma.

3. Completar las tres ramas de un umbral abre el siguiente umbral de forma determinista, en cualquier dispositivo.
4. Ningún camino de error borra, resetea ni pone a cero filas existentes en Turso.
5. Cada operación de red muestra un estado legible por un alumno de 64 años y se recupera sin perder la sesión.
