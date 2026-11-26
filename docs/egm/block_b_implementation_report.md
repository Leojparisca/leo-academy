# Bloque (b) — Respaldo seguro e integridad de datos

**Fecha:** 2026-11-13
**Estado:** Implementado y verificado. Sin cambios en la base de datos de Turso.
**Alcance aprobado:** B3, B4, M2, M3, M4 del informe `docs/egm/goldfish_review_report.md`.
**Base:** `docs/egm/2026-11-13_concepts_brief_estabilizacion.md`.

---

## 1. Resultado de la verificación

| Comprobación | Comando | Resultado |
| --- | --- | --- |
| Tipos | `node .\node_modules\typescript\bin\tsc --noEmit` | **0 errores** (exit 0) |
| Build de producción | `npm run build` | **0 errores** (exit 0) |
| Aviso de build | — | Solo el preexistente `Failed to find font override values for font 'Google Sans'` |
| Operaciones destructivas nuevas | grep `\.delete\(` en `src/server/actions/**` | **Ninguna** |
| Migraciones / seeds ejecutados | — | **Ninguno** |

No se ejecutó ninguna consulta contra Turso. No se borró, reseteó ni puso a cero ninguna fila.

---

## 2. Archivos modificados

| Archivo | Δ | Motivo |
| --- | --- | --- |
| `src/lib/sync-keys.ts` | nuevo (+120) | Identidad compartida de filas entre navegador y servidor |
| `src/lib/local-db.ts` | +227 / −80 | `readBackupPayload`, `markBackupSynced(result, manifest)`, `clientId` |
| `src/lib/backup.ts` | +46 / −0 | Esquema con `clientId`, rechazos tipados, aviso de truncado |
| `src/server/actions/sync.ts` | +51 / −25 | Rechazos por clave, IDs canónicos, desempate de `accuracy` |
| `src/server/actions/students.ts` | +37 / −10 | ID canónico, resultado de `persistPractice`, rechazos explícitos |
| `src/server/actions/live.ts` | +4 / −1 | `live_*` → `score_*` |
| `src/components/providers/academy-provider.tsx` | +74 / −22 | Manifiesto, avisos, `clientId` en los tres escritores locales |
| `src/data/curriculum.ts` | +6 / −2 | `getCurriculumNode` sin fallback al nodo 0 |

---

## 3. Qué se arregló, punto por punto

### 3.1 `markBackupSynced(result, manifest)` — B3

**Antes:** la función no recibía la respuesta del servidor. Releía Dexie *después* de la llamada de red, marcaba como sincronizado todo lo que entraba en los topes y borraba la cola de práctica completa, incluidos los `skipped`.

**Ahora:**

1. `readBackupPayload()` construye en **una sola pasada** el dump y su manifiesto: `{ id local, clave natural, sello temporal }` por fila, más `{ queueId, clave }` por sesión.
2. El servidor devuelve `summary.rejected` con las claves naturales que rechazó.
3. `markBackupSynced` marca `synced: 1` solo si se cumplen las tres condiciones:
   - la fila estaba en el manifiesto;
   - su clave no aparece en `rejected`;
   - su sello no cambió desde que se construyó el dump.
4. En la cola: las sesiones aceptadas se borran; las rechazadas **se conservan** en `offlineQueue` con estado `failed` (visibles, sin bucle de reintento); las creadas durante el vuelo nunca estuvieron en el manifiesto, así que no se tocan.

**Invariante que ahora se cumple:** una fila solo se declara sincronizada si viajó y el servidor la aceptó.

### 3.2 Escritor canónico de `skill_scores` — B4

**Antes:** el mismo ejercicio podía insertar tres filas con tres IDs distintos:

| Escritor | ID anterior |
| --- | --- |
| `persistPractice` | `score_<clientId>` |
| `syncLiveProgressAction` | `live_<clientId>` |
| `syncBackupAction` | `score_<sha1(student,skill,source,createdAt,score)>` |

**Ahora:** un único espacio de IDs, `scoreRowId(clientId)` = `score_<clientId>`, en los tres caminos. El `clientId` nace en el navegador cuando ocurre el evento y viaja con la fila local. `onConflictDoNothing` por fin deduplica de verdad.

El mismo tratamiento se aplicó a `xp_ledger`: `xpRowId(clientId)` sustituye al hash dependiente del reloj.

**Compatibilidad:** las filas antiguas sin `clientId` siguen usando el hash anterior. No se reescribe historia ni se fusionan filas retroactivamente.

### 3.3 IDs independientes del reloj del dispositivo — M2

`LocalSkillScore` y `LocalXpEntry` incorporan `clientId?: string`, generado con `uid()` al crear la fila. El dump lo envía (`clientId` opcional en el esquema Zod, para no romper clientes antiguos) y el servidor lo usa como clave primaria. Un reloj adelantado o una zona horaria distinta ya no pueden duplicar XP.

### 3.4 Desempate de `accuracy` — M4

**Antes:** `record.totalMinutes >= current.totalMinutes` → en empate ganaba el dispositivo, aunque su precisión fuera menor. El comentario del código decía "never move backwards" y el operador lo contradecía.

**Ahora:** `record.totalMinutes > current.totalMinutes`, y aun ganando por minutos se aplica `Math.max(current.accuracy, record.accuracy)`. La precisión nunca disminuye en ninguna rama.

### 3.5 Aviso de techo en `BACKUP_LIMITS` — M3

- `readBackupPayload()` detecta cada tabla que supera su tope y devuelve `truncated: [{ table, total, kept }]`.
- `describeBackupTruncation()` (en `backup.ts`) redacta el aviso en lenguaje llano.
- `backupToServer` lo muestra como advertencia, junto con el número de filas rechazadas, en un único mensaje (el sistema de avisos solo mantiene uno).

Ejemplo: *"El respaldo llevó solo lo más reciente (puntuaciones: 2000 de 2413). Lo demás sigue guardado en este teléfono y viajará en el próximo respaldo."*

### 3.6 `getCurriculumNode` sin fallback silencioso

Devuelve `CurriculumNode | null`. El único consumidor (`recordCurriculumResult`) aborta con aviso: *"No encontramos esa lección en el mapa. No se guardó nada."* Antes, un ID desconocido sellaba el nodo 0 y otorgaba XP por una lección que el alumno nunca jugó.

---

## 4. Dos correcciones adicionales necesarias para que el invariante fuera cierto

No estaban en la lista literal del usuario, pero sin ellas la restricción "cero pérdida" seguía rota por caminos paralelos:

1. **`flushQueue`** marcaba *todas* las entradas de la cola como `completed` ignorando `rejected`. Ahora `syncPracticeSessionsAction` devuelve `rejectedClientIds`, las rechazadas quedan en `failed` y se avisa al alumno.
2. **`persistPractice`** devolvía `false` tanto para "alumno/nivel desconocido" como para "la sesión ya existía". Ahora devuelve `"stored" | "duplicate" | "rejected"`: un duplicado cuenta como éxito (la fila ya está a salvo) y solo el rechazo conserva la fila en el dispositivo. Además, `logPracticeAction` ya no devuelve `ok: true` cuando el servidor rechazó la práctica, así que el provider la encola en lugar de perderla.

---

## 5. Lo que este bloque NO hace (importante)

- **No hay ruta de lectura de progreso.** Un dispositivo nuevo sigue viendo el perfil sin progreso. Eso es el Bloque (a).
- **No corrige duplicados históricos.** Las filas `skill_scores` y `xp_ledger` ya infladas en Turso siguen ahí. Limpiarlas exige una decisión explícita: fusionar filas cambia datos reales de alumnos y no se hace sin aprobación.
- **No toca `seed.ts`**, ni el borrado de IDs de demostración, ni el esquema de la base de datos.
- **No cambia `BACKUP_VERSION`.** Los campos nuevos son opcionales y compatibles en ambas direcciones: un cliente antiguo contra el servidor nuevo usa el hash de siempre; un cliente nuevo contra un servidor antiguo envía un campo que Zod descarta.

---

## 6. Verificación manual recomendada (no hay runner en el repo)

| Caso | Qué debe pasar |
| --- | --- |
| Respaldo normal con red | Notificación de éxito, cola vacía, `dirtyRows` en 0 |
| Respaldo con una sesión de un nivel inexistente | La sesión queda en `offlineQueue` como `failed`, aviso visible, nada borrado |
| Terminar una lección mientras el respaldo está en vuelo | La nueva fila no se marca como sincronizada |
| Dos respaldos seguidos del mismo dispositivo | `xp_ledger` y `skill_scores` no crecen la segunda vez |
| Dispositivo con más de 2000 puntuaciones | Aviso de truncado con el conteo exacto |
| `recordCurriculumResult` con `nodeId` inválido | Aviso, sin XP, sin estrellas, sin fila |

---

## 7. Estado del árbol

```
M  src/components/providers/academy-provider.tsx
M  src/data/curriculum.ts
M  src/lib/backup.ts
M  src/lib/local-db.ts
M  src/server/actions/live.ts
M  src/server/actions/students.ts
M  src/server/actions/sync.ts
?? src/lib/sync-keys.ts
?? docs/
```

Sin commits. Sin `git add`. A la espera de luz verde para el Bloque (a).
