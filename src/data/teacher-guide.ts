/**
 * Leo Academy — Phase 4 "Guía Docente de Leo".
 *
 * The teleprompter the teacher reads while a lesson is live:
 *   1. a 60-second hook (an everyday/psychological analogy),
 *   2. a 2-minute physical dynamic before touching the keys,
 *   3. an error diagnosis with positive-reinforcement corrections.
 *
 * Client-safe: no server code, no secrets.
 */

export type TeacherGuide = {
  /** The 60-second analogy: what to say, almost word for word. */
  hook: {
    title: string;
    analogy: string;
    landing: string;
  };
  /** Two minutes with voice and hands, before the keyboard. */
  body: {
    title: string;
    minutes: number;
    steps: string[];
    closing: string;
  };
  /** What to watch in wrist, fingering and muscular tension. */
  diagnostics: Array<{
    signal: string;
    watch: string;
    fix: string;
  }>;
  /** One sentence to repeat while the student plays. */
  mantra: string;
};

export const TEACHER_GUIDES: Record<string, TeacherGuide> = {
  /* ------------------------------------------------------------------ RITMO */
  "cur-ritmo-1": {
    hook: {
      title: "El pulso es la acera",
      analogy:
        "Piensa en una acera larga y en tus pasos. La acera no corre: tú decides a qué velocidad caminas. Si el suelo se moviera solo, cada paso sería una caída. El pulso es eso, el suelo firme debajo de la música.",
      landing:
        "Hoy no vamos a tocar rápido: vamos a caminar sobre una acera que no se mueve.",
    },
    body: {
      title: "Caminar y pasar el pulso",
      minutes: 2,
      steps: [
        "Camina en el sitio contando 1-2-3-4 en voz alta, sin prisa.",
        "Quita la voz y sigue contando solo con el pie. ¿Sigue igual de estable?",
        "Ahora toca el pulso con la palma en el muslo, alternando mano izquierda y derecha.",
        "Juego de espejo: tú marcas cuatro golpes, el alumno los repite sin acelerar el último.",
      ],
      closing:
        "Cuando el pie puede contar sin la voz, el pulso ya vive en el cuerpo y no en la cabeza.",
    },
    diagnostics: [
      {
        signal: "El talón golpea el suelo con fuerza",
        watch:
          "Suele indicar que el alumno está marcando con toda la pierna y bloqueando la cadera.",
        fix: "Cambia a golpe de punta y dile: «el pie susurra, no grita». Refuerza en cuanto el sonido se vuelva ligero.",
      },
      {
        signal: "Los hombros suben en cada tiempo",
        watch:
          "Es tensión respiratoria: está aguantando el aire para no perder el conteo.",
        fix: "Hazle contar en voz alta mientras espira. Celebra el primer compás en el que los hombros no se muevan.",
      },
      {
        signal: "El último golpe se adelanta",
        watch:
          "Ansiedad por terminar. Muy común en alumnos que quieren «acertar» rápido.",
        fix: "Repite solo los dos últimos golpes, lentos, y di: «el final también es música». Refuerzo inmediato al cuarto golpe exacto.",
      },
    ],
    mantra: "La acera no corre. Mis pasos sí pueden elegir.",
  },

  "cur-ritmo-2": {
    hook: {
      title: "Una pizza partida en dos",
      analogy:
        "Si el tiempo es una porción de pizza, la corchea es esa misma porción cortada por la mitad. No hay más pizza: hay dos trozos. Por eso al decir «ta-ka» seguimos dentro del mismo tiempo, solo que ahora lo habitamos dos veces.",
      landing:
        "La corchea no acelera el pulso: lo llena. El pie sigue marcando una sola pizza.",
    },
    body: {
      title: "Ta-ka con paso firme",
      minutes: 2,
      steps: [
        "Caminando, di «ta» en cada paso y añade «ka» entre paso y paso: ta-ka, ta-ka.",
        "Mantén el pie solo en los «ta»; la mano toca los «ka» en el aire.",
        "Cambia el papel: palma en «ta», dedos en «ka», sin cambiar la velocidad del pie.",
        "Cuenta en voz alta 1-y-2-y mientras el alumno responde con las palmas.",
      ],
      closing:
        "Si el pie no cambia de velocidad al aparecer las corcheas, la subdivisión está bien construida.",
    },
    diagnostics: [
      {
        signal: "El pie acelera cuando entran las corcheas",
        watch:
          "La subdivisión está sustituyendo al pulso en vez de decorarlo.",
        fix: "Vuelve a caminar sin palmas durante cuatro tiempos y di: «primero el suelo, después el adorno». Refuerza cada vez que el pie se mantenga estable.",
      },
      {
        signal: "Antebrazo rígido y muñeca plana",
        watch:
          "Está tocando desde el codo para ir más rápido, no desde la muñeca.",
        fix: "Hazle dibujar pequeños círculos en el aire con la muñeca, luego repetir el patrón. Señala en voz alta cuando la muñeca se suelte.",
      },
      {
        signal: "La cabeza marca cada corchea con un gesto grande",
        watch:
          "El exceso de movimiento corporal suele robar precisión al golpe.",
        fix: "Reduce el gesto a un parpadeo o un dedo. «Menos cuerpo, más escucha». Celebra la primera tanda sin cabeceo.",
      },
    ],
    mantra: "El pie sostiene; las manos decoran.",
  },

  "cur-ritmo-3": {
    hook: {
      title: "El escalón que no está",
      analogy:
        "Sube una escalera y salta un escalón a propósito. El cuerpo se sorprende, pero no se cae: el siguiente escalón sigue ahí. La síncopa es ese escalón que falta: el pulso continúa, el acento se muda.",
      landing:
        "Nadie deja de subir por saltarse un escalón. Nadie deja de contar por tocar fuera del tiempo.",
    },
    body: {
      title: "Pisar y palmear distinto",
      minutes: 2,
      steps: [
        "Marca el pulso con el pie: 1, 2, 3, 4.",
        "Ahora aplaude solo en los «y» (entre tiempos), sin dejar de pisar.",
        "Regla del juego: «donde pisas no aplaudes; donde aplaudes no pisas».",
        "Alterna cuatro tiempos normales y cuatro sincopados, siempre contando en voz alta.",
      ],
      closing:
        "La síncopa se siente en el cuerpo cuando el pie y la palma se separan sin discutir.",
    },
    diagnostics: [
      {
        signal: "El acento cae justo en el tiempo",
        watch:
          "El oído está corrigiendo la síncopa hacia lo cómodo.",
        fix: "Quita las palmas y deja solo el pie durante un compás completo; vuelve a entrar en el «y». Refuerza el primer contratiempo limpio con un «¡ahí!».",
      },
      {
        signal: "El pie se detiene al palmear",
        watch:
          "El alumno no puede sostener dos capas a la vez: el pulso se le cae.",
        fix: "Reduce el patrón a un solo contratiempo por compás. «Primero el suelo, luego el salto». Celebra que el pie siga vivo.",
      },
      {
        signal: "Hombro y cuello tensos",
        watch:
          "Está anticipando el golpe con todo el torso en lugar de con la mano.",
        fix: "Hazle soltar los brazos y sacudir las manos diez segundos. Reintroduce el patrón con el gesto más pequeño posible.",
      },
    ],
    mantra: "El pulso se queda; el acento se va de viaje.",
  },

  "cur-ritmo-4": {
    hook: {
      title: "El silencio es el chiste",
      analogy:
        "Un chiste no funciona sin la pausa antes del remate. Si hablas sin parar, nadie se ríe. En música pasa igual: el silencio no es un hueco vacío, es el tiempo que hace que el siguiente golpe signifique algo.",
      landing:
        "Hoy vamos a tocar el silencio: se cuenta igual que una nota, solo que no suena.",
    },
    body: {
      title: "Contar el aire",
      minutes: 2,
      steps: [
        "Cuenta 1-2-3-4 en voz alta y da una palmada solo en 1 y 3.",
        "En los tiempos 2 y 4, en vez de callarte, respira audiblemente: el silencio también ocupa.",
        "Repite el patrón con el pie marcando los cuatro tiempos y las manos solo en 1 y 3.",
        "Quita la voz: el alumno debe seguir contando por dentro y demostrarlo con el pie.",
      ],
      closing:
        "Si el pie no se acelera durante el silencio, el alumno ya está midiendo el aire.",
    },
    diagnostics: [
      {
        signal: "El silencio se acorta",
        watch:
          "El alumno siente el vacío como un error y corre hacia la siguiente nota.",
        fix: "Oblígale a decir «silencio» en voz alta durante el hueco. Refuerza cuando el hueco dure lo mismo que un tiempo cantado.",
      },
      {
        signal: "Rellena el silencio con un golpe fantasma",
        watch:
          "Inseguridad: prefiere sonar a estar en silencio.",
        fix: "Convierte el silencio en una tarea activa: «tu única misión es no tocar». Celebra el compás con hueco limpio como un logro, no como una ausencia.",
      },
      {
        signal: "Mirada fija en las manos",
        watch:
          "Está comprobando si «va bien» en lugar de escuchar.",
        fix: "Pídele mirar un punto fijo de la pared y contar con el pie. «Confía en el conteo». Refuerzo al terminar sin mirar.",
      },
    ],
    mantra: "Cuento el silencio igual que cuento la nota.",
  },

  "cur-ritmo-5": {
    hook: {
      title: "Tres músicos en un solo cuerpo",
      analogy:
        "Imagina una banda: el baterista lleva el pulso, el bajista empuja los contratiempos y el cantante dibuja la melodía. Ahora imagina que los tres son la misma persona: pie, mano y voz. Eso es un groove completo.",
      landing:
        "Hoy no tocaremos más notas: haremos que tres capas del mismo cuerpo se escuchen entre sí.",
    },
    body: {
      title: "Pie, palma y voz",
      minutes: 2,
      steps: [
        "Pie en el pulso. Palma en los contratiempos. Voz contando 1-2-3-4.",
        "Retira la voz y deja pie y palma hablando solos durante cuatro tiempos.",
        "Añade una sílaba cantada («da») solo en el tiempo 1.",
        "Alterna compases con y sin síncopa, manteniendo las tres capas.",
      ],
      closing:
        "Un groove se reconoce porque ninguna capa tapa a las otras. Si una desaparece, todavía no está.",
    },
    diagnostics: [
      {
        signal: "Una capa se come a las demás",
        watch:
          "Normalmente la mano: el alumno toca fuerte y el pie deja de existir.",
        fix: "Baja el volumen de la mano a la mitad y sube el del pie. «El groove es un equipo, no una estrella». Refuerza el compás equilibrado.",
      },
      {
        signal: "La mandíbula se aprieta",
        watch: "Tensión global por exceso de concentración.",
        fix: "Pausa de diez segundos respirando en 4-4. Vuelve al patrón con la mandíbula floja y una sonrisa mínima.",
      },
      {
        signal: "El tempo se arrastra tras la síncopa",
        watch:
          "El cuerpo se relaja de más después del acento desplazado.",
        fix: "Marca el tiempo 1 del compás siguiente en voz alta. «El acento pasa; el pulso vuelve a casa». Celebra el retorno exacto.",
      },
    ],
    mantra: "Pie, mano y voz: tres músicos, un solo cuerpo.",
  },

  /* ---------------------------------------------------------------- MELODÍA */
  "cur-melodia-1": {
    hook: {
      title: "La voz que sube cuando te emocionas",
      analogy:
        "Cuando cuentas algo emocionante, la voz sube; cuando terminas una idea, baja. La melodía hace lo mismo con las manos: sube, baja, se queda. Antes de saber el nombre de una nota, ya sabemos hacia dónde va la historia.",
      landing:
        "Hoy entrenamos el oído como se entrena un gesto: mirando la dirección antes que la altura.",
    },
    body: {
      title: "Dibujar con la mano y con la voz",
      minutes: 2,
      steps: [
        "Canta «mmm» subiendo y baja la mano como si pintaras una colina.",
        "Repite bajando la voz y la mano a la vez, como un tobogán.",
        "Juego de espejo: tú cantas dos notas y el alumno dibuja la dirección en el aire; luego al revés.",
        "Sin nombre de notas: solo «sube», «baja» o «se queda».",
      ],
      closing:
        "Si la mano dibuja la dirección antes de que el oído la nombre, el alumno ya está escuchando de verdad.",
    },
    diagnostics: [
      {
        signal: "El alumno adivina por altura absoluta",
        watch:
          "Intenta reconocer la nota concreta en vez de la distancia.",
        fix: "Tapa la referencia y pídele solo «arriba o abajo». «No quiero el nombre, quiero la dirección». Refuerza cada respuesta gestual.",
      },
      {
        signal: "La mano se queda congelada",
        watch:
          "Miedo a equivocarse: prefiere no dibujar antes que dibujar mal.",
        fix: "Dibuja tú primero, exagerando. Luego dibujad juntos. Celebra el intento aunque la dirección sea incorrecta.",
      },
      {
        signal: "Cierra los ojos con fuerza al escuchar",
        watch: "Exceso de esfuerzo; la escucha se vuelve tensión facial.",
        fix: "Propón escuchar con los ojos abiertos y la mandíbula suelta. «Escuchar es abrir, no apretar».",
      },
    ],
    mantra: "Primero la dirección; el nombre puede esperar.",
  },

  "cur-melodia-2": {
    hook: {
      title: "La tercera es la ceja del acorde",
      analogy:
        "Dos caras pueden ser idénticas; solo cambia la ceja. Una sonríe y la otra mira al suelo. En música, la tercera es esa ceja: la nota del medio decide si el acorde sonríe o llora.",
      landing:
        "Hoy no memorizamos distancias: aprendemos a reconocer la cara del intervalo.",
    },
    body: {
      title: "Cantar la distancia",
      minutes: 2,
      steps: [
        "Cantad «cumpleaños feliz» y señalad el salto inicial: esa es una tercera.",
        "Cantad una tercera menor con la mano baja y una mayor con la mano alta.",
        "El alumno canta la nota base y tú la tercera; luego intercambiad.",
        "Sin teclado: solo voz, mano y la palabra «amplia» o «estrecha».",
      ],
      closing:
        "Cuando el alumno puede cantar la tercera antes de tocarla, el intervalo deja de ser un cálculo.",
    },
    diagnostics: [
      {
        signal: "Nombra el intervalo antes de cantarlo",
        watch:
          "Está usando la memoria teórica y no el oído.",
        fix: "Pídele tararear primero y nombrar después. «El oído va delante de la boca». Refuerza cualquier tarareo afinado.",
      },
      {
        signal: "Canta muy bajito",
        watch:
          "Vergüenza o inseguridad; la voz no se compromete con la altura.",
        fix: "Acompaña con la voz y sube el volumen juntos. «Aquí nadie audiciona». Celebra el primer intervalo cantado con confianza.",
      },
      {
        signal: "Pierde la nota de referencia",
        watch:
          "Canta la segunda nota sin sostener la primera en la memoria.",
        fix: "Hazle sostener la nota base con un «mmm» continuo mientras mueve la otra. «Una nota se apoya en la anterior».",
      },
    ],
    mantra: "La tercera decide la cara del acorde.",
  },

  "cur-melodia-3": {
    hook: {
      title: "El pentagrama es un edificio de cinco pisos",
      analogy:
        "Cada línea es un piso y cada espacio es un descansillo. Las notas no se mueven de cualquier manera: suben o bajan un piso cada vez. Si aprendes a leer el edificio, no necesitas memorizar cada apartamento.",
      landing:
        "Hoy vamos a leer por pisos, no por nombres sueltos: cada paso es una segunda.",
    },
    body: {
      title: "Señalar antes de tocar",
      minutes: 2,
      steps: [
        "Dibuja cinco líneas en el aire con la mano y nómbralas: Mi-Sol-Si-Re-Fa.",
        "Señala un espacio y un piso con el dedo; el alumno dice «sube» o «baja».",
        "Canta la nota señalada con sílaba fija («mi») antes de tocar el piano.",
        "Solo después, toca la misma nota en el teclado y comprueba si coincide.",
      ],
      closing:
        "Leer es reconocer la dirección y la distancia; el nombre llega como consecuencia, no como requisito.",
    },
    diagnostics: [
      {
        signal: "Lee nota por nota, sin relación",
        watch:
          "Está memorizando posiciones aisladas en vez de intervalos.",
        fix: "Tapa la nota anterior y pregúntale solo si la siguiente sube o baja. «Leemos relaciones, no fotos». Refuerza la primera lectura por distancia.",
      },
      {
        signal: "Mueve la cabeza buscando la altura",
        watch:
          "Está usando el cuerpo para calcular en vez de leer.",
        fix: "Ancla la mirada en el pentagrama y usa el dedo como puntero. «Los ojos leen, la mano toca».",
      },
      {
        signal: "Dedo índice rígido al señalar",
        watch:
          "Tensión anticipatoria: quiere tocar antes de haber leído.",
        fix: "Separa lectura y ejecución con una pausa de un segundo. Celebra la pausa como parte del ejercicio.",
      },
    ],
    mantra: "Leo pisos y distancias, no fotos sueltas.",
  },

  "cur-melodia-4": {
    hook: {
      title: "Leer como se conduce en autopista",
      analogy:
        "En la autopista no miras el capó: miras lejos. Si miras la punta del coche, frenas todo el rato. Al leer música pasa igual: los ojos van un compás por delante de las manos.",
      landing:
        "Hoy entrenamos la mirada larga: leer la nota siguiente mientras suena la actual.",
    },
    body: {
      title: "Ojos por delante",
      minutes: 2,
      steps: [
        "Señala tres notas seguidas y pide al alumno que nombre solo la segunda mientras suena la primera.",
        "Cuenta en voz alta «1-2» y cambia el dedo señalado en el «2», no en el «1».",
        "Sin piano: recorrido de cinco notas con el dedo, siempre un paso por delante.",
        "Con una sola nota en el piano: toca y lee en silencio la siguiente.",
      ],
      closing:
        "La velocidad de lectura nace de la anticipación, no de mover los dedos más rápido.",
    },
    diagnostics: [
      {
        signal: "Se detiene en cada nota",
        watch:
          "Está verificando en vez de leyendo; la mirada vuelve atrás.",
        fix: "Cubre la nota ya leída con un papel. «Lo que ya sonó no se relee». Refuerza cada avance sin retroceso.",
      },
      {
        signal: "Gira la cabeza hacia el teclado",
        watch:
          "Necesita confirmar la posición con la vista.",
        fix: "Pon el atril ligeramente alto y pide leer sin mirar las manos. «Las manos saben dónde están».",
      },
      {
        signal: "Aguanta la respiración",
        watch: "La velocidad se confunde con esfuerzo.",
        fix: "Marcar la respiración cada dos compases. «Leer rápido no es no respirar».",
      },
    ],
    mantra: "Los ojos van un compás por delante.",
  },

  "cur-melodia-5": {
    hook: {
      title: "Reconocer caras, no medir distancias",
      analogy:
        "No mides la cara de tu amigo con una regla: la reconoces. Con los intervalos pasa igual. Al principio cuentas semitonos; con práctica reconoces la «cara» de una quinta o de una octava al instante.",
      landing:
        "Hoy cambiamos la regla por el reconocimiento: cuatro caras, mil canciones.",
    },
    body: {
      title: "Anclas cantadas",
      minutes: 2,
      steps: [
        "Elegid un ancla por intervalo: 2ª, 3ª, 5ª y octava, cada una con una canción conocida.",
        "Cantad las cuatro anclas seguidas, subiendo y bajando.",
        "Tú tocas un intervalo; el alumno canta el ancla y luego dice el nombre.",
        "Intercambio: el alumno inventa el intervalo y tú lo reconoces en voz alta.",
      ],
      closing:
        "Cuando el alumno tiene un ancla para cada distancia, deja de calcular y empieza a reconocer.",
    },
    diagnostics: [
      {
        signal: "Solo reconoce intervalos ascendentes",
        watch:
          "Las anclas se aprendieron en una sola dirección.",
        fix: "Canta cada ancla también descendente. «La cara es la misma de espaldas». Refuerza el primer descenso acertado.",
      },
      {
        signal: "Recita la letra de la canción en vez de escuchar",
        watch:
          "La memoria verbal tapa la memoria auditiva.",
        fix: "Sustituye la letra por una sílaba neutra («da»). «Sin letra, solo distancia».",
      },
      {
        signal: "Aprieta los ojos y el cuello",
        watch:
          "Esfuerzo de reconocimiento: busca con el cuerpo.",
        fix: "Respiración lenta y hombros abajo antes de cada intervalo. Celebra la respuesta relajada, no solo la correcta.",
      },
    ],
    mantra: "No mido la cara: la reconozco.",
  },

  /* ---------------------------------------------------------------- ARMONÍA */
  "cur-armonia-1": {
    hook: {
      title: "Tres amigos de la mano",
      analogy:
        "Un acorde son tres amigos que se dan la mano. La raíz es la que guía, la quinta es la que sostiene y la tercera es la que decide el ánimo. Si la tercera sonríe, el acorde es mayor; si mira al suelo, es menor.",
      landing:
        "Hoy no construimos acordes de memoria: aprendemos a escuchar el ánimo de la tercera.",
    },
    body: {
      title: "Apilar el aire",
      minutes: 2,
      steps: [
        "Canta la raíz y sosténla con «mmm».",
        "Añade la tercera cantada: primero mayor (sonrisa), luego menor (suspiro).",
        "Con la mano en el aire, apila tres alturas: raíz abajo, tercera en medio, quinta arriba.",
        "Solo entonces, toca las tres notas y compara el color con lo que cantaste.",
      ],
      closing:
        "Si el alumno puede cantar la tercera antes de tocarla, el acorde deja de ser una forma y se vuelve un color.",
    },
    diagnostics: [
      {
        signal: "Aprieta las teclas con fuerza",
        watch:
          "Confunde volumen con presencia; la mano se cierra.",
        fix: "Pide tocar el acorde «como si las teclas fueran agua». Refuerza el sonido cuando la mano esté suelta, no cuando suene más.",
      },
      {
        signal: "Dedos planos y muñeca hundida",
        watch:
          "Falta de arco en la mano; el peso cae hacia abajo.",
        fix: "Coloca una pelota imaginaria bajo la palma y toca con dedos redondos. «La mano es un puente, no una plancha».",
      },
      {
        signal: "Confunde la tercera con la quinta",
        watch:
          "Todavía escucha el bloque, no las voces internas.",
        fix: "Toca solo raíz y tercera; luego raíz y quinta. «Escucha de dos en dos». Celebra cuando distinga el color del medio.",
      },
    ],
    mantra: "La tercera decide el ánimo; la quinta sostiene.",
  },

  "cur-armonia-2": {
    hook: {
      title: "Tres climas, tres acordes",
      analogy:
        "Mayor es un día de sol, menor es una tarde de lluvia y disminuido es una puerta que se abre sola en una película de miedo. Las tres tienen las mismas tres notas posibles; cambia una sola distancia.",
      landing:
        "Hoy vamos a cambiar el clima moviendo un solo dedo, no tres.",
    },
    body: {
      title: "Un dedo, tres climas",
      minutes: 2,
      steps: [
        "Forma una tríada mayor en el aire y canta el clima «sol».",
        "Baja el dedo del medio un semitono y canta «lluvia»: ya es menor.",
        "Baja también la quinta un semitono y canta «miedo»: ya es disminuido.",
        "Vuelve al mayor y repite el viaje solo con la voz.",
      ],
      closing:
        "El alumno que siente el cambio de clima con un dedo entiende la armonía sin memorizar fórmulas.",
    },
    diagnostics: [
      {
        signal: "Mueve toda la mano para cambiar el acorde",
        watch:
          "No ha aislado la voz que cambia: la tercera.",
        fix: "Deja los dedos de raíz y quinta fijos y mueve solo el del medio. «Solo un dedo tiene permiso».",
      },
      {
        signal: "El diminutivo suena igual que el menor",
        watch:
          "La quinta disminuida pasa desapercibida.",
        fix: "Toca solo la quinta justa y la disminuida, alternando. «Escucha cómo se cierra la puerta».",
      },
      {
        signal: "Muñeca bloqueada al cambiar de clima",
        watch: "Tensión por miedo a equivocarse de tecla.",
        fix: "Cambia de acorde en el aire, sin teclado, tres veces. Luego toca. Refuerza la soltura, no la precisión.",
      },
    ],
    mantra: "Un dedo, un semitono, otro clima.",
  },

  "cur-armonia-3": {
    hook: {
      title: "La frase que no termina",
      analogy:
        "Cuando alguien dice «y entonces…» y se calla, tu oído espera el final. El Sus4 hace eso: deja la frase abierta. El disminuido es la puerta que chirría en la película: sabes que algo va a pasar.",
      landing:
        "Hoy jugamos con la tensión: no resolveremos rápido, aprenderemos a sostener la pregunta.",
    },
    body: {
      title: "Sostener la pregunta",
      minutes: 2,
      steps: [
        "Canta «y entonces…» y deja el aire en suspenso. Repite con un Sus4.",
        "Resuelve el Sus4 bajando la cuarta a tercera y canta «…y ya está».",
        "Alterna tres veces pregunta/respuesta solo con la voz.",
        "Con la mano en el aire, mantén la forma suspendida y no la cierres hasta el último segundo.",
      ],
      closing:
        "El alumno que puede sostener la tensión sin tocarla entiende que la armonía también es teatro.",
    },
    diagnostics: [
      {
        signal: "Resuelve el Sus4 demasiado pronto",
        watch:
          "Impaciencia armónica: el silencio de la tensión incomoda.",
        fix: "Cuenta cuatro tiempos sosteniendo el acorde antes de resolver. «La pregunta también es música». Refuerza la espera.",
      },
      {
        signal: "Hombros y cuello tensos en el disminuido",
        watch:
          "El color tenso se contagia al cuerpo.",
        fix: "Sacude los hombros y vuelve a tocar el disminuido con una sonrisa. «La tensión es del acorde, no tuya».",
      },
      {
        signal: "No escucha la resolución",
        watch:
          "Toca las dos posiciones seguidas sin dejar que el oído compare.",
        fix: "Toca Sus4, cuenta cuatro y resuelve. Pregunta «¿qué cambió?» antes de volver a tocar.",
      },
    ],
    mantra: "Sostengo la pregunta antes de dar la respuesta.",
  },

  "cur-armonia-4": {
    hook: {
      title: "El giro de la historia",
      analogy:
        "Una película con tres escenas está bien; con un giro inesperado se vuelve inolvidable. La séptima es ese giro: maj7 añade nostalgia, m7 añade melancolía y la dominante añade una pregunta que exige respuesta.",
      landing:
        "Hoy añadimos la cuarta voz: la que convierte un acorde en una historia.",
    },
    body: {
      title: "La nota que falta",
      minutes: 2,
      steps: [
        "Canta una tríada mayor y sostén la Fundamental.",
        "Añade la séptima cantada, aguda y suave: escucha la nostalgia.",
        "Baja la tercera para pasar a menor séptima; siente cómo cambia el relato.",
        "Con la dominante, canta la séptima y resuélvela mentalmente hacia la tónica.",
      ],
      closing:
        "La séptima no se toca más fuerte: se toca con intención, como el giro de una historia.",
    },
    diagnostics: [
      {
        signal: "La séptima suena más fuerte que el resto",
        watch:
          "Curiosidad por la nota nueva; rompe el equilibrio de voces.",
        fix: "Pide tocar la séptima al 50 % de volumen. «La cuarta voz susurra». Refuerza el acorde equilibrado.",
      },
      {
        signal: "Mano abierta con tensión en el pulgar",
        watch:
          "La extensión de séptima exige más apertura de la que la mano tiene.",
        fix: "Reduce la apertura y toca la séptima con la mano relajada, aunque falte la quinta. «Primero cómodo, después completo».",
      },
      {
        signal: "No distingue maj7 de dominante",
        watch:
          "Escucha el acorde como bloque, sin la tensión interna.",
        fix: "Aísla la séptima: 11 semitonos (maj7) contra 10 (dominante). «Un semitono separa la nostalgia de la pregunta».",
      },
    ],
    mantra: "La cuarta voz susurra el giro de la historia.",
  },

  "cur-armonia-5": {
    hook: {
      title: "Cuatro puertas que giran",
      analogy:
        "Entra en una casa con cuatro habitaciones: la primera abre, la segunda empuja, la tercera llora y la cuarta respira. Al final vuelves a la primera y el círculo no se cierra: gira. Eso es I–V–vi–IV.",
      landing:
        "Hoy no memorizamos cuatro acordes: caminamos por cuatro puertas y sentimos cómo se enlazan.",
    },
    body: {
      title: "Caminar la progresión",
      minutes: 2,
      steps: [
        "Asigna un gesto a cada grado: I abre los brazos, V empuja, vi baja la mirada, IV respira.",
        "Camina cuatro pasos marcando los gestos mientras cantas la fundamental de cada acorde.",
        "Quédate en V y siente la pregunta; resuelve a I con un suspiro audible.",
        "Repite el círculo completo dos veces sin hablar, solo con gestos y voz.",
      ],
      closing:
        "Cuando el cuerpo recuerda los cuatro gestos, la progresión deja de ser una lista y se vuelve un camino.",
    },
    diagnostics: [
      {
        signal: "La mano salta entre acordes",
        watch:
          "Está pensando en posiciones, no en voces comunes.",
        fix: "Señala una nota que se queda quieta entre dos acordes y pide mantenerla. «La voz común es el imán».",
      },
      {
        signal: "Pierde la fundamental al cantar",
        watch:
          "La progresión tapa el bajo; el oído se queda en la superficie.",
        fix: "Canta solo las fundamentales mientras tocas los acordes. «El bajo es el suelo del camino».",
      },
      {
        signal: "El V no suena como pregunta",
        watch:
          "La dominante se toca igual que los demás acordes, sin tensión.",
        fix: "Detente en V y cuenta cuatro tiempos antes de resolver. «La pregunta necesita aire».",
      },
    ],
    mantra: "Cuatro puertas, un círculo que gira.",
  },
};

export function getTeacherGuide(nodeId: string): TeacherGuide | null {
  return TEACHER_GUIDES[nodeId] ?? null;
}
