# Goldfish Review Report: Leo Academy Mobile Native Draft

**Target:** `docs/egm/native_mobile_design_draft.md` (full file, lines 1–83)  
**Round:** 1 (single requested rapid round)  
**Reviewers:** Pez 1 — Arquitecto Expo & Seguridad Turso; Pez 2 — UX Empática, alumno de 64 años en Android  
**Status:** completed for both reviewers. Nits omitted per request. No repairs applied; review halted after this round.

## Findings

### [pez1-1-1] [Major] — Contrato de API y sesión móvil ausentes
**Reviewer:** Pez 1  
**Affected scope:** Lines 15, 57–62

El draft promete compatibilidad con las tablas y llaves canónicas, pero no define endpoints `/api/mobile/*`, sus contratos, autenticación, autorización, validación ni cómo se aplicará el merge. En el backend actual las lecturas de progreso dependen de la cookie HMAC web `leo_student`; las escrituras verifican una sesión de alumno o profesor. Esa cookie no se transfiere automáticamente a una app nativa. Sin contrato API ni mecanismo de sesión nativa, queda al implementador decidir cómo autenticar y limitar cada llamada.

### [pez1-1-2] [Major] — Código de acceso de baja entropía sin protección definida
**Reviewer:** Pez 1  
**Affected scope:** Lines 26, 57–59

El ingreso con código de cuatro dígitos no explica cómo el backend valida el intercambio código-alumno ni protege ese endpoint frente a intentos automatizados. El espacio de códigos es pequeño y permite probar combinaciones; faltan límites de intentos, demoras/bloqueo y una política explícita de emisión y renovación de sesión/token nativo.

### [pez1-1-3] [Major] — Semántica de sincronización y claves no coinciden con el backend actual
**Reviewer:** Pez 1  
**Affected scope:** Lines 15, 17, 60–62

El merge promete unión de currículo/lecciones y sincronización bidireccional, pero hoy `curriculum_progress` y `xp_ledger` llegan a Turso mediante respaldo del profesor; las acciones del alumno guardan práctica, puntuaciones y progreso de lección. Además, el mismo evento puede producir IDs diferentes (`sess_…`, `live_…`, `score_…`); el código actual deriva la clave de puntuación vía `scoreRowId(clientId)`, por lo que las llaves descritas en el draft no quedan demostradas como canónicas. Se debe definir el contrato de escritura por tabla, identidad idempotente por evento y semántica de merge para evitar duplicados o progreso que no se persiste.

### [pez2-1-1] [Major] — No hay salida clara si el alumno intenta entrar sin conexión
**Reviewer:** Pez 2  
**Affected scope:** §2 (línea 26) y §4.A

El login se describe como numpad/código y el arranque requiere consultar el backend; no se define cómo recuperar una sesión/progreso ya descargado ni cómo continuar sin red al iniciar. Para el alumno, esto puede parecer un código rechazado o pérdida de avance. Definir el estado offline de inicio: permitir entrar con perfil local cuando exista y sincronizar luego; si no existe, explicar en lenguaje claro que se requiere conexión y ofrecer reintento.

### [pez2-1-2] [Major] — Errores de login y lectura remota no tienen mensajes ni acciones móviles
**Reviewer:** Pez 2  
**Affected scope:** §2 (línea 26) y §4.A

Solo se prescribe “Buscando tu progreso…” y el mensaje de outbox; no se asignan estados/acciones a código inválido, nombre/código que no coinciden, DB inaccesible ni fallo inicial de lectura. Cada estado necesita texto comprensible y una acción próxima —corregir código, reintentar o seguir con copia local— para que el alumno no quede esperando sin saber qué ocurrió.

### [pez2-1-3] [Major] — Estado de guardado puede confundirse con sincronización completada
**Reviewer:** Pez 2  
**Affected scope:** §3.2 (líneas 47–52) y §4.A

“Guardado aquí” aplica a resultados, pero el draft no dice si el botón principal sigue disponible offline, qué significa “Todo guardado” cuando quedan elementos en la cola ni cómo se recuperan tras reiniciar el teléfono. El alumno podría creer que el progreso está en la nube y cambiar de dispositivo. Definir estados persistentes y copy que diferencie el guardado en este teléfono de la sincronización confirmada, además de la acción de reintento.

## Alcance de la ronda

Se ejecutó una sola ronda con exactamente dos Peces Dorados aislados. No se aplicaron cambios al borrador y no se creó `leo-academy-mobile/`.
