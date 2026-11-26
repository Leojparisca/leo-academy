# Design Draft: Leo Academy Mobile (Nativa iOS / Android)
**Versión:** 1.0 (MVP Nativo)
**Stack:** Expo (SDK 54+), Expo Router, TypeScript, NativeWind, `expo-sqlite`, `expo-audio`, `expo-haptics`
**Backend / Persistencia:** Backend Next.js en Vercel como única frontera de acceso a Turso (libSQL / SQLite remoto). La app móvil nunca incluye credenciales de Turso.

## 1. Problema, Visión y No-Objetivos

### El Problema
La versión web actual genera fricción cognitiva: los alumnos (de 12 a 64 años) se pierden entre menús, sufren latencia táctil en el navegador móvil y pierden la continuidad cuando cambian de dispositivo.

### La Visión
Transformar Leo Academy en una **aplicación nativa de un solo carril ("Camino Asfaltado")** donde el alumno abre la app y en **1 toque con el pulgar** ya está practicando, con audio nativo sin retardo, vibración háptica real y sincronización bidireccional garantizada contra la base de datos Turso existente.

### Restricciones Innegociables
1. **Compatibilidad con el esquema Turso:** Reutilizar las tablas existentes (`students`, `lesson_progress`, `curriculum_progress`, `skill_scores`, `xp_ledger`, `practice_sessions`) sin afirmar que todas ya se sincronizan desde el flujo del alumno. Ningún alumno pierde su progreso actual. Antes de habilitar clientes móviles, fijar y documentar las claves idempotentes por evento a partir del esquema y escritores existentes; `sess_<clientId>` identifica sesiones de práctica y no se asumirá que `score_<clientId>` o `xp_<clientId>` son claves canónicas hasta verificarlas. No importar/repetir en paralelo un evento ya guardado por otro escritor.
2. **Cero menús de inicio:** La pantalla principal (`/(academy)/index`) no tiene barras de navegación inferiores ni múltiples tarjetas; es una única pantalla enfocada en la acción del momento.
3. **Resiliencia Offline (Service Recovery):** Si se corta el internet en mitad de una clase o práctica, el alumno sigue jugando sin interrupciones; los resultados se guardan en `expo-sqlite` y se envían automáticamente al reconectar.

### No-Objetivos (V1)
- Panel administrativo del profesor dentro de la app móvil (el profesor sigue gestionando desde la web o su panel).
- Registro abierto de nuevos usuarios sin código asignado por el profesor.

## 2. Arquitectura del Sistema y Navegación (Expo Router)

- `app/_layout.tsx`: Boot — Hidratación Pull-First + Listener de red + Auth Gate.
- `app/welcome.tsx`: Ingreso con código de 4 dígitos (numpad nativo grande). Con conexión, solicita el código y canjea una sesión móvil. Sin conexión, permite entrar solo si hay una sesión móvil vigente protegida y un perfil local ya descargado; de lo contrario muestra: **“Necesitas internet para entrar por primera vez. Conéctate y vuelve a intentarlo.”** y el botón **“Reintentar”**. No presenta un fallo de red como código incorrecto.
- `app/(academy)/index.tsx`: HOME — "Camino Asfaltado" (1 Tarjeta + 1 Botón Gigante).
- `app/(academy)/session.tsx`: EJECUTOR — Encadena lecciones y juegos sin volver al inicio.
- `app/(academy)/cascada.tsx`: ARCADE HORIZONTAL — Lock en Landscape + Teclado Multitouch.
- `app/(academy)/map.tsx`: VISTA SECUNDARIA — Árbol de niveles completo y Salón de Juegos.

### Contrato de autenticación móvil y API

- La app llama exclusivamente al backend Next.js desplegado en Vercel mediante HTTPS. No se conecta directamente a Turso ni incluye `DATABASE_AUTH_TOKEN`, `TURSO_AUTH_TOKEN` u otra credencial maestra en el bundle, variables públicas o almacenamiento del dispositivo.
- Exponer endpoints de alumno bajo `/api/mobile/v1/`: `POST /session` canjea el código; `GET /progress` devuelve el paquete del alumno autenticado; `POST /practice/sync` acepta lotes acotados de práctica offline. Cada endpoint valida esquema, tamaño, campos permitidos y pertenencia del registro a la sesión. Nunca acepta un `studentId` de cliente como autorización.
- `POST /session` valida el código asignado por el profesor. Para conservar códigos existentes, la UI admite sus 4–8 caracteres alfanuméricos; el teclado numérico es apropiado solo si el código de ese alumno es numérico. No se expone el endpoint de creación de perfiles.
- Al canjear el código, el servidor emite un token de sesión móvil opaco, aleatorio, revocable y de duración limitada; almacena solo su hash asociado al alumno. La app lo guarda en `expo-secure-store`, lo envía como bearer token por HTTPS y lo borra al cerrar sesión. La cookie web HMAC `leo_student` no se reutiliza como token móvil. La respuesta no devuelve códigos privados ni datos de otros alumnos.
- El canje tiene límites por IP y por código, respuesta genérica que no distingue código inexistente de credenciales incorrectas, enfriamiento progresivo y registro de intentos; no se bloquea permanentemente al alumno. El backend valida expiración y revocación en cada llamada autenticada.
- El progreso consultado puede incluir solo los datos asociados al alumno autenticado. `students.teacherNotes` y demás información privada del profesor quedan excluidas.

## 3. Diseño Visual y Psicología de Retención

### A. Sistema Visual (Visual QA Protocol)
- **Fondo abisal fijo:** `#06080F` (Obsidian Dark).
- **3 Radios estrictos:**
  - Tarjetas contenedoras: `rounded-3xl` (24px).
  - Controles, teclas y modales: `rounded-2xl` (16px).
  - Botón principal, píldoras y badges: `rounded-full` (9999px).
- **3 Niveles de opacidad:**
  - Texto primario e iconos críticos: `#F8FAFC` (100%).
  - Subtítulos y contexto ("Alcancía"): `rgba(255, 255, 255, 0.65)`.
  - Bordes y divisores sutiles: `rgba(255, 255, 255, 0.08)`.
- **Punto focal único:** Solo el botón inferior del pulgar lleva brillo azul eléctrico (`#0D6EFD` / cian `#38BDF8`).

### B. Los 6 Motores Psicológicos en Pantalla
1. **El Picor + Reloj Tick-Tock:** Medidor superior de **Resonancia Auditiva (0%–100%)** y contador de expiración diaria (`Expira en HH:MM:SS`). Si pasan 48 horas sin practicar, la resonancia baja suavemente; 2 minutos de práctica la restauran al 100%.
2. **El Camino Asfaltado:** El motor selecciona automáticamente el siguiente nodo pendiente del currículo o el ejercicio donde el alumno tuvo menor precisión, mostrándolo en una sola tarjeta central.
3. **El Pulgar Perezoso:** Botón inferior de altura `64px` ocupado al 100% del ancho útil: **`EMPEZAR PRÁCTICA (2 MIN)`**.
4. **La Máquina Tragamonedas:** Al cerrar un bloque de 3 ejercicios, una ruleta de recompensa entrega XP variable (`+30 XP`, `+50 XP`, o `Cofre Dorado: Doble XP`).
5. **El Pozo Sin Fondo:** La pantalla de victoria nunca tiene botón "Salir" como acción principal; tiene un botón gigante en el mismo lugar del pulgar: **`SIGUIENTE DESAFÍO`** que encadena el próximo ejercicio inmediatamente.
6. **La Alcancía:** Mensaje personalizado arriba de la tarjeta basado en el historial real del alumno (*"Hoy reforzamos tu enlace Do -> Fa"*).

### C. Estados de ingreso y recuperación
- Código incorrecto o no reconocido: **“No pudimos entrar con ese código. Revísalo o pídeselo a tu profe.”** Acción: **“Intentar de nuevo”**; el campo se conserva editable y nunca se borra el perfil local.
- Servicio no disponible durante el canje: **“No pudimos conectar con la academia. Revisa tu internet e inténtalo otra vez.”** Acciones: **“Reintentar”** y, si hay sesión móvil vigente con perfil local, **“Entrar con lo guardado en este teléfono”**.
- Sesión expirada/revocada: explicar que debe conectarse e ingresar de nuevo; no borrar datos locales ni la outbox.
- Al entrar sin red con sesión local vigente, mostrar **“Estás usando el progreso guardado en este teléfono. Se sincronizará al volver el internet.”** y permitir abrir la práctica.

## 4. Contratos Técnicos Críticos

### A. Sincronización Bidireccional (`src/lib/sync-engine.ts`)
- **Al iniciar sesión (`welcome.tsx`) o abrir la app (`_layout.tsx`):**
  1. Muestra estado honesto en cabecera: `"Buscando tu progreso…"` (nunca un punto sin texto).
  2. Ejecuta `GET /api/mobile/v1/progress` con el token móvil. Sin credenciales directas de Turso en el cliente.
  3. **Merge de lectura local:** aplica por campo las reglas de unión documentadas para cada entidad; no usa `max()` universal para valores que pueden corregirse. `xp_ledger` y eventos son conjuntos por ID idempotente, no sumas duplicadas; métricas derivadas se recalculan con reglas acordadas en backend. Los conflictos irresolubles se conservan localmente y se reportan, nunca borran datos.
  4. Muestra **“Todo guardado en este teléfono”** solo si no hay elementos locales pendientes. Muestra **“Progreso sincronizado”** solo tras confirmación del servidor y cola vacía.
- **Outbox Offline:** Cada evento recibe un `clientId` UUID generado una vez y persistido en `expo-sqlite`; reintentos conservan el mismo ID. El servidor aplica escrituras transaccionales e idempotentes y responde por ID aceptado/rechazado. La app marca `synced = 1` únicamente los IDs confirmados; rechazados y fallidos siguen en cola. Se acota tamaño de lote y se reintenta con backoff al recuperar red o abrir la app.
- Actualmente las escrituras autenticadas del alumno cubren práctica, puntuación y progreso de lección; `curriculum_progress` y `xp_ledger` no deben darse por sincronizados por este camino. Antes de activar el móvil, el backend debe definir su escritor móvil canónico y reconciliarlo con `syncBackupAction` y los escritores existentes, de modo que cada evento tenga un único ID estable y no se duplique. La lectura de Turso debe devolver solo el paquete del alumno autenticado.
- **Estados visibles:** durante lectura: **“Buscando tu progreso…”**; error remoto: **“No pudimos traer tu progreso. Tus datos siguen aquí.”** Acciones: **“Reintentar”** y **“Seguir practicando”** si hay copia local. Con cola pendiente: **“Guardado aquí. Se enviará al volver el internet.”** Acción: **“Reintentar ahora”**. La pantalla principal y práctica permanecen disponibles con datos locales; nunca se muestra estado de sincronización completa mientras haya cola pendiente.
- En Android, una práctica offline queda persistida antes de actualizar el estado de éxito. La cola sobrevive al cierre forzado y reinicio; Home permanece habilitada si hay lección local disponible y muestra el estado pendiente. Si no hay contenido descargado para la siguiente actividad, se explica que debe conectarse y se ofrece reintentar.

### B. Motor de Audio y Tacto Nativo (`src/lib/native-audio.ts`)
- **Zero-Latency Touch:** Uso exclusivo de `onPressIn` de React Native (dispara en el primer contacto físico del dedo, 0ms de espera) combinado con `Haptics.impactAsync(ImpactFeedbackStyle.Light)`.
- **Pre-carga de Samples:** Al arrancar la app, precargar en memoria los buffers WAV/OGG de piano (octavas C3–G5) y percusión (bombo, caja, hi-hat, metrónomo) usando `expo-audio` / `react-native-audio-api` para evitar decodificación durante el toque.
- **Compensación de Latencia + Calibrador:** Ventana asimétrica para el ejercicio rítmico (`-110ms` temprano / `+190ms` tardío) + calibrador opcional de 4 toques guardado en `expo-sqlite` (`device_latency_offset_ms`).

### C. Pantallas de Lección y Juegos Nativos
1. **Ritmo (Escucha y Repite):**
   - Fase A: Cuenta visual `1 · 2 · 3 · 4` + pulso luminoso central + reproducción del patrón (pad bloqueado).
   - Fase B: Pad táctil gigante en la mitad inferior + 4 esferas de progreso arriba (si falla un compás, repite solo ese compás sin borrar los anteriores).
2. **Melodía Guiada:**
   - Teclado multitouch real en pantalla con la tecla objetivo iluminada en cian y el número de dedo (`1`, `3`, `5`).
3. **Cascada Zafiro (Modo Horizontal):**
   - Bloquea orientación con `ScreenOrientation.lockAsync(OrientationLock.LANDSCAPE)` al entrar y la restaura a `PORTRAIT` al salir.
   - Renderiza los bloques cayendo a 60 FPS (`react-native-reanimated` / Skia) con el **Hilo Ancla dorado** conectando notas comunes entre acordes.

## 5. Plan de Ejecución por Fases

- **Fase 1 (Base y Sincronización):** Crear proyecto Expo (`leo-academy-mobile/`), configurar NativeWind (`#06080F`), `expo-sqlite` y el motor de sincronización Pull-First + Outbox conectado al backend.
- **Fase 2 (Home de 1 Botón + Motor de Audio):** Implementar `welcome.tsx` (código de 4 dígitos), `(academy)/index.tsx` (Camino Asfaltado + Tick-Tock) y `native-audio.ts` con precarga de sonidos y háptica.
- **Fase 3 (Lecciones Guiadas + Cascada Zafiro):** Portar las lecciones de Ritmo, Melodía y el juego horizontal *Cascada Zafiro* con el flujo continuo ("Pozo Sin Fondo").
