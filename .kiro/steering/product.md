# EnFoco — Product Steering

## Nombre del producto

**EnFoco**

## Descripción

EnFoco es una agenda inteligente universal disponible para iPhone, Android y web. Permite a las personas organizar su día, crear rutinas dinámicas y medir su cumplimiento real para desarrollar disciplina y constancia a lo largo del tiempo.

**Tagline:** Organiza tu día. Enfócate en avanzar.

---

## Problema que resuelve

Muchas personas quieren ser más productivas pero no cuentan con una herramienta que les ayude a planificar, ejecutar y reflexionar sobre su día de forma sencilla. Las agendas tradicionales son estáticas, y las apps de tareas no miden el cumplimiento real ni fomentan la mejora continua.

EnFoco cierra esa brecha: convierte la intención en acción y la acción en hábito.

---

## Usuarios objetivo

- Personas que quieren organizar mejor su tiempo.
- Profesionales independientes y estudiantes.
- Personas que están desarrollando disciplina personal.
- Usuarios que buscan una herramienta simple, sin fricción y orientada al avance diario.

---

## Propuesta de valor

- Planifica tu día en segundos con plantillas o tablero vacío.
- Registra el cumplimiento total o parcial de cada actividad.
- Visualiza cuánto avanzaste durante el día con un porcentaje claro.
- Consulta tu progreso diario y semanal para identificar patrones.
- Disponible en todos tus dispositivos: iPhone, Android y web.

---

## Principios del producto

1. **Simplicidad sobre complejidad.** Cada pantalla debe tener un propósito claro.
2. **Ejecución sobre planificación excesiva.** La app ayuda a hacer, no a planear indefinidamente.
3. **Progreso visible.** El usuario debe saber en todo momento cuánto avanzó.
4. **Mobile-first.** La experiencia principal se diseña para el celular; la web complementa.
5. **Sin fricción.** Registrar una actividad debe tomar menos de dos segundos.
6. **Honestidad.** El cumplimiento parcial es mejor que no registrar nada.
7. **Adaptabilidad.** Las rutinas son dinámicas; el usuario las controla.

---

## Alcance inicial del MVP

- Crear actividades con nombre, duración estimada y hora de inicio.
- Organizar actividades en un tablero del día.
- Comenzar desde una plantilla o desde un tablero vacío.
- Registrar cada actividad como completada (total o parcialmente).
- Ver el porcentaje de cumplimiento del día en tiempo real.
- Consultar el resumen del día al finalizar.
- Consultar el progreso de la semana actual.
- Soporte para iPhone, Android y web.

---

## Funciones excluidas del MVP

- Creación o reorganización de actividades por voz.
- Notificaciones push y recordatorios automáticos.
- Integración con calendarios externos (Google Calendar, Apple Calendar).
- Compartir rutinas entre usuarios.
- Modo colaborativo o de equipos.
- Análisis avanzado o reportes históricos más allá de la semana.
- Gamificación (puntos, insignias, rachas).
- Suscripciones o pagos en la primera versión.

---

## Clasificación de cumplimiento diario

| Porcentaje alcanzado | Clasificación   |
|----------------------|-----------------|
| 80 % – 100 %         | Día completo    |
| 60 % – 79,99 %       | Día aceptable   |
| 40 % – 59,99 %       | Día mínimo      |
| 0 % – 39,99 %        | Día perdido     |

Esta clasificación se muestra al usuario al finalizar el día y en el resumen semanal.

---

## Principio mobile-first

El diseño y la experiencia se optimizan primero para pantallas pequeñas (iPhone y Android). La versión web es funcional y útil, pero los flujos principales se validan primero en móvil.

---

## Diferencia de uso por plataforma

- **En el computador se organiza:** el usuario planifica su semana, crea o edita plantillas y revisa su historial de progreso.
- **En el celular se ejecuta:** el usuario sigue su tablero del día, registra cumplimiento y consulta su avance en tiempo real.

---

## Preparación futura para voz

EnFoco está diseñado para incorporar en el futuro la creación y reorganización de actividades por voz. Esta función **no se implementa en el MVP**, pero la arquitectura debe evitar acoplamientos que la dificulten. Los flujos de creación de actividades deben ser suficientemente modulares para aceptar una fuente de entrada por voz sin reescribirse.

---

## Idioma de la interfaz y del código

- **Textos visibles en la interfaz de usuario:** español.
- **Código fuente, nombres de variables, funciones, tipos, archivos y carpetas:** inglés.
- **Términos técnicos y documentación interna:** inglés.
- **Comentarios en el código:** inglés.
