# Bloque (a) — Ruta de lectura de progreso, precarga y estados visibles

**Fecha:** 2026-11-16
**Estado:** Implementado y verificado. Sin escrituras en la base de datos de Turso.
**Alcance aprobado:** B1, B2, B6, M1, M5, N1 del informe `docs/egm/goldfish_review_report.md`.
**Base:** `docs/egm/2026-11-13_concepts_brief_estabilizacion.md` (§7 estados y copy, §9 criterios).

---

## 1. Resultado de la verificación

| Comprobación | Comando | Resultado |
| --- | --- | --- |
| Tipos | `node .\node_modules\typescript\bin\tsc --noEmit` | **0 errores** (exit 0) |
| Build de producción | `npm run build` | **0 errores** (exit 0) |
| Aviso de build | — | Solo el preexistente `Failed to find font override values for font 'Google Sans'` |
| Escrituras en Turso | Inspección de solo lectura (SELECT) | **Ninguna**. `lesson_progress = 12`, `skill_scores = 89`, `curriculum_progress = 0`, `xp_ledger = 0` al cerrar |
| Filas de prueba persistentes | IndexedDB del navegador | Eliminadas al terminar: `curriculumProgress = 0`, `xpLedger = 0` |

No se ejecutó `INSERT`, `UPDATE`, `DELETE` ni migración contra Turso. Los datos de prueba para el merge se
inyectaron **solo en Dexie del navegador** y se borraron al final de la verificación.

---

## 2. Archivos del bloque

| Archivo | Δ | Motivo |
| --- | --- | --- |
| `src/lib/progress-package.ts` | nuevo | Contrato del paquete y `canonicalClientId` |
| `src/server/queries/students.ts` | +89 | `getStudentProgressPackage(studentId)` — 5 tablas en una pasada |
| `src/server/actions/students.ts` | +88 | `fetchStudentProgressAction()` sin parámetro de alumno |
| `src/lib/local-db.ts` | +665 / −… | `hydrateFromServer` (merge Max-Wins), origen de fila, dump sin filas del servidor |
| `src/app/(academy)/layout.tsx` | +16 | Precarga del paquete junto al perfil |
| `src/components/providers/academy-provider.tsx` | +318 | Siembra, `progressState`, `hydrateProgress`, `reloadProgress`, avisos |
| `src/components/shell/header.tsx` | +125 | `SyncStatus` con la tabla de §7 |
| `src/components/curriculum/curriculum-map.tsx` | +47 | Banners de "Buscando…" y de error, `unlockedLevel` sobre el progreso fusionado |
| `src/components/shell/student-welcome.tsx` | +68 | Código de 4–8 caracteres sin truncar (N1) |
| `src/components/shell/app-shell.tsx` | +2 | Espacio para la nueva línea de estado |

---

## 3. Qué se arregló, punto por punto

### 3.1 Una ruta de lectura que no existía — B2

**Antes:** `refreshFromServer()` solo pedía el perfil (`fetchStudentsAction`). Ningún alumno podía leer
`lesson_progress`, `curriculum_progress`, `skill_scores` ni `xp_ledger` desde otro dispositivo.

**Ahora:**

1. `getStudentProgressPackage(studentId)` lee las cinco tablas en un único `Promise.all`, ordena por fecha y
   acota `stars` a 1–3.
2. `fetchStudentProgressAction()` **no acepta `studentId`**: la identidad sale solo de `getStudentSessionId()`
   (cookie `leo_student`). Sin sesión → `UNAUTHORIZED`; sin fila → `NOT_FOUND`; error de base → `DB_UNAVAILABLE`
   y `null` en la query.
3. El paquete viaja en un solo objeto: `students` + `lesson_progress` + `curriculum_progress` + `skill_scores` +
   `xp_ledger`. Una llamada, no cinco.

**Invariante:** un alumno no puede pedir el progreso de otro ni manipulando la petición, porque no hay parámetro
que manipular.

### 3.2 Precarga antes del primer render — B2

`(academy)/layout.tsx` lee perfil y paquete en el servidor y los pasa a `AcademyProvider`. El primer render del
mapa ya tiene `curriculum` y XP; no hay pantalla vacía seguida de un salto. Después, `boot()` escribe el paquete
en Dexie **antes** del primer snapshot local, de modo que un dispositivo nuevo arranca hidratado incluso si la
red se corta en ese instante.

### 3.3 Merge monótono Max-Wins — M1 / B1

`hydrateFromServer(pkg)` fusiona sin retroceder:

| Tabla | Regla |
| --- | --- |
| `lessonProgress` | estado por rango (`completed` > `current` > `locked`), `progress` y minutos con `Math.max` |
| `curriculumProgress` | unión por `nodeId`; estrellas y precisión con `Math.max` |
| `skillScores` | identidad por `clientId` canónico (`score_` fuera) con respaldo por contenido |
| `xpLedger` | identidad por `clientId` (`xp_` fuera); si discrepa el monto, gana el mayor |

Las filas que bajan del servidor se marcan `synced: 1` y `origin: "server"`. `readBackupPayload()` las excluye
del dump y del manifiesto (`localOnlyScores` / `localOnlyXp`), así que no se reenvían ni consumen los topes del
respaldo.

`HydrationConflict` distingue `remoteAhead`, `localAhead` y `hadLocalProgress`. El aviso de §7 se emite **solo**
cuando la academia iba por delante y el teléfono ya tenía progreso; un dispositivo limpio nunca ve el mensaje.

### 3.4 Estados visibles con el copy exacto — B6 / M5

`SyncStatus` (cabecera) y el mapa comparten una sola fuente, `progressState` + `hydrated`:

| Situación | Texto |
| --- | --- |
| Leyendo progreso | `Buscando tu progreso…` |
| Sincronizado de verdad | `Todo guardado` |
| Sin conexión o con cola pendiente | `Guardado aquí. Se enviará cuando vuelva el internet.` |
| Falló la lectura | `No pudimos traer tu progreso. Tus datos siguen aquí.` |
| Teléfono por detrás | `Este teléfono tenía avance más antiguo. Conservamos el más avanzado.` |

Reglas aplicadas:

- `Todo guardado` exige `hydrated`, es decir, que se leyeron las tablas de progreso. Que llegue el perfil
  (`dataSource === "server"`) no autoriza esa frase.
- El estado ocupa su propia línea a ancho completo bajo el selector. Se eliminaron `hidden min-[398px]` y
  `hidden min-[430px]`: el texto es visible a 320 px, sin truncar.
- En modo profesor `SyncStatus` devuelve `null` y `hydrateProgress` retorna temprano: el panel no aplica el
  progreso de un alumno a la vista del docente.
- `Reintentar` aparece en error y con cola pendiente; el mapa ofrece `Reintentar` / `Seguir practicando`.

### 3.5 Código de alumno de 4–8 caracteres — N1

La validación del brief admite 4–8; la interfaz capturaba 4 y truncaba. Ahora la fila empieza en 4 casillas y
crece hasta 8 cuando el código pegado/escrito lo necesita, con un botón explícito para códigos largos. El
generador emite 6 caracteres en el caso de colisión, así que truncar a 4 hacía inalcanzable esa cuenta.

---

## 4. Verificación en navegador

Sesión limpia, login real (`Edward Antonio Bellorin Marcano` / `FRMG`, `stu_c1f7787f`).

| # | Escenario | Resultado observado |
| --- | --- | --- |
| 1 | Arranque en frío | `Todo guardado`; `01 Fundamentos ABIERTO`, `02 Contraste EN CURSO`; 8 min, 62 %, 13 % del sendero; ramas 0/5 (coherente: Turso no tiene currículo ni XP) |
| 2 | Estado a 320 px | Contenedor 280 px, etiqueta 74×13 px en una línea, `overflowX = false`, sin clases que la oculten, sin recorte |
| 3 | Merge visible | 3 nodos de nivel 1 + 1 fila de XP inyectados en Dexie → recarga: ramas 1/5, estrellas 3/3/2 (8 en total), XP 540, nivel 1 sellado y nivel 2 activo |
| 4 | Filas del servidor fuera del respaldo | 53/53 `skillScores` con `origin: "server"` → 0 filas de puntajes viajan; `dirtyRows = 4` (3 de currículo + 1 de XP) |
| 5 | Conflicto | Con el servidor por delante (stub de solo lectura): aviso exacto a los 253 ms, XP reconciliado 400 → 900, estrellas conservadas |
| 6 | Error de lectura | Stub temporal `DB_UNAVAILABLE`: cabecera y mapa con el copy de §7, `Reintentar` y `Seguir practicando` visibles, sin `Todo guardado` (`hydrated = false`) |
| 7 | Modo Sin Luz | `Guardado aquí. Se enviará cuando vuelva el internet.`; al desactivar vuelve `Todo guardado` |

Los stubs de los casos 5 y 6 fueron temporales, se revirtieron y el `tsc`/`build` finales se ejecutaron después
de revertirlos. Las filas inyectadas se borraron: el dispositivo quedó como estaba.

---

## 5. Hallazgos corregidos durante la verificación

Dos fallos reales aparecieron al probar, no al compilar:

1. **`boot()` se cancelaba a sí mismo en desarrollo.** `bootedRef` impedía la segunda ejecución del efecto y el
   flag `cancelled` abortaba la primera en su primer `await`. React StrictMode monta, desmonta y remonta el
   efecto conservando la instancia: el resultado era un perfil pintado con el progreso local ignorado
   (`students` vacío, `curriculum` y XP en cero). Se eliminó el corte por `cancelled`; `boot()` es idempotente y
   corre completo una sola vez.
2. **El monto de XP no se reconciliaba cuando el `clientId` coincidía.** La rama "la fila ya existe" solo
   marcaba `synced`, así que un monto corregido en la academia no subía el total y Max-Wins no se cumplía. Ahora
   esa rama también aplica `Math.max` y cuenta como `remoteAhead` cuando la academia va por delante.

---

## 6. Límites de la verificación

- Turso tiene `curriculum_progress = 0` y `xp_ledger = 0`. Ningún alumno real puede desbloquear nodos desde la
  nube hasta que un profesor respalde desde `syncBackupAction`. El desbloqueo por datos del servidor se verificó
  con un stub de lectura, jamás escribiendo en Turso.
- El conflicto entre dos teléfonos no es reproducible con datos reales por la misma razón. La lógica se verificó
  con el stub del caso 5 y con filas inyectadas solo en IndexedDB.
- No hay runner de pruebas (`vitest`/`jest`) en el proyecto: la verificación es manual, con navegador y
  comprobaciones de DOM/IndexedDB.

---

## 7. Estado del árbol

Este bloque deja **13 archivos rastreados modificados** (`layout`, `academy-provider`, `local-db`, `header`,
`curriculum-map`, `student-welcome`, `app-shell`, `data/curriculum`, `lib/backup`, `actions/live`,
`actions/students`, `actions/sync`, `queries/students`) más 3 rutas sin rastrear propias:
`src/lib/sync-keys.ts`, `src/lib/progress-package.ts` y `docs/`.

Después de cerrar la verificación aparecieron en el árbol cambios **ajenos a este bloque** (una app Expo en
`leo-academy-mobile/`, rutas `src/app/api/mobile/*` y `src/server/auth/mobile-*`, además de `.env.example` y
`tsconfig.json`). No se tocaron ni se revisaron aquí; se mencionan solo para que el estado del árbol no se
atribuya a este trabajo. `tsc --noEmit` sigue en 0 errores con ellos presentes.

Sin `git add` y sin commits. El Bloque (c) —latencia rítmica— no se tocó y queda a la espera de aprobación
explícita.
