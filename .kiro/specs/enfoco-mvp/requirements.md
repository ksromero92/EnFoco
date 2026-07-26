# EnFoco MVP — Documento de Requisitos

**Versión:** 1.0  
**Fecha:** 2026-07-26  
**Estado:** Borrador — pendiente de revisión  
**Spec:** enfoco-mvp  
**Archivo:** requirements.md

---

## 1. Introducción

EnFoco es una agenda inteligente universal disponible para iPhone, Android y web. Su propósito es ayudar a las personas a organizar actividades y horarios, registrar lo que realmente cumplen, medir su progreso diario y semanal, y desarrollar disciplina y constancia a lo largo del tiempo.

**Tagline:** Organiza tu día. Enfócate en avanzar.

Este documento define los requisitos funcionales y no funcionales del MVP de EnFoco. Está orientado a orientar el diseño técnico (`design.md`) y la planificación de tareas (`tasks.md`) en etapas posteriores.

Los requisitos describen comportamiento observable y verificable. No prescriben decisiones de implementación salvo cuando sea estrictamente necesario para la coherencia del producto.

### Alcance de este documento

Este documento cubre los siguientes módulos del MVP:

1. Autenticación y sesión
2. Onboarding
3. Plantilla inicial y tablero vacío
4. Categorías dinámicas
5. Actividades dinámicas
6. Tipos de seguimiento y estados de cumplimiento
7. Pantalla Hoy
8. Pantalla Semana
9. Rutinas
10. Ciclos de objetivos
11. Cálculo del cumplimiento diario
12. Clasificación diaria
13. Progreso e historial
14. Actividades informativas
15. Diseño adaptable y navegación
16. Seguridad y privacidad
17. Estado sin conexión y manejo de errores
18. Preparación futura para voz


---

## 2. Glosario

| Término | Definición |
|---|---|
| **Actividad** | Unidad básica de la agenda. Tiene nombre, horario, categoría, tipo de seguimiento y estado de cumplimiento. |
| **Rutina** | Conjunto de actividades recurrentes que conforman el patrón habitual del usuario. |
| **Plantilla** | Colección predefinida de actividades que el usuario puede cargar como punto de partida. |
| **Tablero del día** | Vista principal de la pantalla Hoy: lista ordenada de actividades programadas para la fecha actual. |
| **Ciclo** | Período de tiempo con fecha de inicio y duración definida por el usuario (p. ej. 90 días) dentro del cual se mide el progreso. |
| **Cumplimiento** | Medida de cuánto completó el usuario de lo que tenía programado. Puede ser total, parcial, justificado o excluido. |
| **Porcentaje de cumplimiento** | Resultado de dividir los puntos obtenidos entre los puntos programados para una fecha, multiplicado por 100. |
| **Clasificación del día** | Etiqueta asignada al día según el porcentaje de cumplimiento: Día completo, Día aceptable, Día mínimo o Día perdido. |
| **Peso / Prioridad** | Valor relativo que determina cuánto aporta una actividad al porcentaje de cumplimiento del día. |
| **Categoría** | Agrupación temática de actividades (p. ej. Trabajo, Ejercicio, Alimentación). Tiene nombre, color e ícono. |
| **Sesión** | Estado autenticado del usuario dentro de la aplicación. |
| **Onboarding** | Flujo inicial que el usuario completa una sola vez tras su primer inicio de sesión. |
| **RLS** | Row Level Security: mecanismo de Supabase que garantiza que cada usuario solo accede a sus propios registros. |
| **EAS Build** | Expo Application Services Build: servicio en la nube para compilar la app para iOS y Android sin Xcode local. |
| **Actividad justificada** | Actividad que el usuario marcó con una razón válida de no cumplimiento, y que puede excluirse del denominador del cálculo. |
| **Actividad informativa** | Actividad que no aporta al porcentaje de cumplimiento pero es visible en el tablero del día. |
| **Racha** | Número de días consecutivos en que el usuario alcanzó una clasificación mínima definida. |
| **Conflicto de horario** | Solapamiento de dos o más actividades en la misma franja horaria. |


---

## 3. Objetivos del MVP

1. Permitir que cualquier usuario cree una cuenta, configure su agenda y comience a registrar cumplimiento el mismo día.
2. Proveer una pantalla Hoy que muestre las actividades del día y permita registrar cumplimiento en menos de dos segundos por actividad.
3. Calcular y mostrar el porcentaje de cumplimiento diario en tiempo real.
4. Permitir consultar el progreso de la semana actual.
5. Soportar actividades completamente dinámicas: el usuario las crea, edita, desactiva y elimina.
6. Funcionar en iPhone, Android y navegador web con la misma lógica de dominio y datos.
7. Establecer una arquitectura que permita integrar Supabase, voz e inteligencia artificial en etapas posteriores sin reescribir el modelo de datos ni la lógica de negocio.

---

## 4. Perfiles de usuario

### 4.1 Usuario estándar

- Persona que quiere organizar actividades de trabajo, estudio, ejercicio, alimentación, vida personal u otras áreas.
- Accede principalmente desde el celular para ejecutar y registrar su día.
- Accede desde la web para planificar, organizar rutinas y revisar historial.
- No requiere conocimientos técnicos.

### 4.2 Usuario avanzado (futuro)

- Mismo perfil base, pero utiliza ciclos personalizados, múltiples rutinas y estadísticas detalladas.
- El MVP no requiere diferenciación de roles ni planes de pago.

> **Nota:** Aunque el primer usuario será Kevin y existirá una plantilla inicial basada en su rutina, la aplicación debe ser multiusuario y completamente dinámica desde el inicio. Ningún requisito debe depender exclusivamente de la rutina personal de Kevin.


---

## 5. Historias de usuario

### Autenticación

- Como usuario nuevo, quiero crear una cuenta, para acceder a mis datos desde cualquier dispositivo.
- Como usuario registrado, quiero iniciar sesión, para retomar mi agenda donde la dejé.
- Como usuario autenticado, quiero cerrar sesión, para proteger mi privacidad en dispositivos compartidos.
- Como usuario que olvidó su contraseña, quiero recuperar el acceso, para no perder mi historial.

### Onboarding

- Como usuario nuevo, quiero conocer brevemente qué hace EnFoco, para entender cómo me ayudará.
- Como usuario nuevo, quiero definir mi nombre y zona horaria, para que el sistema muestre mis actividades en mi horario local.
- Como usuario nuevo, quiero elegir la duración de mi primer ciclo, para comenzar con un horizonte de tiempo que me motive.
- Como usuario nuevo, quiero elegir entre una plantilla y un tablero vacío, para empezar de la forma que me resulte más cómoda.

### Actividades

- Como usuario, quiero crear una actividad con nombre, horario y categoría, para organizar mi día.
- Como usuario, quiero editar cualquier actividad, para ajustar mi agenda cuando cambian mis planes.
- Como usuario, quiero desactivar una actividad sin eliminarla, para mantener mi historial intacto.
- Como usuario, quiero duplicar una actividad, para crear variantes rápidamente.
- Como usuario, quiero reordenar mis actividades, para darles el orden que prefiero visualmente.

### Pantalla Hoy

- Como usuario, quiero ver todas mis actividades del día ordenadas cronológicamente, para saber qué sigue.
- Como usuario, quiero marcar una actividad como completada con un solo toque, para registrar mi avance sin fricción.
- Como usuario, quiero registrar cumplimiento parcial de una actividad, para ser honesto cuando no terminé todo.
- Como usuario, quiero ver mi porcentaje de cumplimiento del día en tiempo real, para saber cuánto avancé.
- Como usuario, quiero justificar o excluir una actividad, para que no me penalice si no pude realizarla por razones externas.

### Semana y rutinas

- Como usuario, quiero ver mis actividades de la semana completa, para planificar con perspectiva.
- Como usuario, quiero consultar y modificar mi rutina activa, para mantenerla alineada con mi vida real.

### Ciclos y progreso

- Como usuario, quiero definir un ciclo con fecha de inicio y duración, para tener un horizonte de esfuerzo sostenido.
- Como usuario, quiero consultar el día actual de mi ciclo y los días restantes, para mantener perspectiva del avance total.
- Como usuario, quiero ver mi porcentaje diario, promedio semanal y clasificación del día, para entender mi evolución.
- Como usuario, quiero consultar mi historial de días anteriores, para identificar patrones y áreas de mejora.


---

## 6. Requisitos funcionales

### 6.1 Autenticación y sesión

**REQ-AUTH-001** — El sistema debe permitir que un usuario nuevo cree una cuenta con credenciales.  
**REQ-AUTH-002** — El sistema debe permitir que un usuario registrado inicie sesión.  
**REQ-AUTH-003** — El sistema debe mantener la sesión activa entre cierres de la aplicación hasta que el usuario cierre sesión explícitamente o el token expire.  
**REQ-AUTH-004** — El sistema debe permitir que el usuario cierre sesión desde cualquier pantalla de perfil.  
**REQ-AUTH-005** — El sistema debe ofrecer un mecanismo de recuperación de acceso compatible con Supabase Auth (p. ej. enlace por correo).  
**REQ-AUTH-006** — El sistema debe garantizar que cada usuario solo acceda a sus propios datos.  
**REQ-AUTH-007** — La arquitectura de autenticación debe permitir agregar proveedores adicionales (Google, Apple) en etapas posteriores sin reconstruir el modelo de usuario.  
**REQ-AUTH-008** — Facebook Login queda fuera del MVP.

### 6.2 Onboarding

**REQ-ONB-001** — El sistema debe mostrar el flujo de onboarding únicamente al usuario que nunca lo completó.  
**REQ-ONB-002** — El onboarding debe explicar brevemente el propósito de EnFoco antes de solicitar datos.  
**REQ-ONB-003** — El sistema debe solicitar el nombre del usuario o su información básica de perfil.  
**REQ-ONB-004** — El sistema debe solicitar la zona horaria del usuario y usarla en todos los cálculos de fecha y hora.  
**REQ-ONB-005** — El sistema debe permitir que el usuario defina la duración de su primer ciclo. La duración sugerida por defecto es 90 días, pero el usuario puede elegir otra duración disponible.  
**REQ-ONB-006** — El sistema debe ofrecer al usuario la opción de cargar una plantilla inicial o comenzar con un tablero vacío.  
**REQ-ONB-007** — Al completar el onboarding, el sistema debe marcar al usuario como configurado y no volver a mostrar el flujo de onboarding completo.  
**REQ-ONB-008** — El usuario debe poder volver a modificar su nombre, zona horaria y otras configuraciones permitidas desde la pantalla de perfil después del onboarding.


### 6.3 Plantilla inicial y tablero vacío

**REQ-TPL-001** — El sistema debe ofrecer al menos una plantilla inicial de actividades como punto de partida.  
**REQ-TPL-002** — Al cargar una plantilla, el sistema debe copiar sus actividades como registros propios del usuario, sin modificar la plantilla global.  
**REQ-TPL-003** — El usuario debe poder modificar, desactivar o eliminar cualquier actividad copiada desde la plantilla.  
**REQ-TPL-004** — El usuario debe poder comenzar con un tablero vacío y agregar actividades manualmente.  
**REQ-TPL-005** — Ninguna actividad, rutina ni plantilla personal debe quedar codificada directamente dentro de componentes de interfaz o constantes del código fuente.  
**REQ-TPL-006** — La plantilla inicial se almacenará en Supabase y se cargará desde allí cuando el backend esté disponible.

### 6.4 Categorías dinámicas

**REQ-CAT-001** — El sistema debe permitir que el usuario cree categorías personalizadas.  
**REQ-CAT-002** — Cada categoría debe tener al menos: nombre, color e ícono.  
**REQ-CAT-003** — El sistema debe permitir editar una categoría existente.  
**REQ-CAT-004** — El sistema debe permitir desactivar una categoría sin eliminarla.  
**REQ-CAT-005** — El sistema puede incluir categorías sugeridas por defecto, pero el usuario no debe estar limitado a ellas.  
**REQ-CAT-006** — Una actividad debe poder pertenecer a una categoría.

### 6.5 Actividades dinámicas

**REQ-ACT-001** — El sistema debe permitir crear una actividad con los siguientes campos: nombre (obligatorio), descripción (opcional), categoría, color o ícono, fecha de inicio, fecha de finalización (opcional), días de la semana, hora de inicio, hora de finalización, duración objetivo, prioridad o peso, tipo de seguimiento, indicación de si cuenta para el porcentaje, estado activo/inactivo, notas (opcional).  
**REQ-ACT-002** — Una actividad puede tener horario exacto o no tener horario.  
**REQ-ACT-003** — Una actividad puede ser de una sola fecha o recurrente.  
**REQ-ACT-004** — Una actividad recurrente puede tener fecha de finalización o ser indefinida.  
**REQ-ACT-005** — El sistema debe permitir editar una actividad existente.  
**REQ-ACT-006** — El sistema debe permitir duplicar una actividad.  
**REQ-ACT-007** — El sistema debe permitir desactivar una actividad sin eliminarla.  
**REQ-ACT-008** — El sistema debe permitir reactivar una actividad previamente desactivada.  
**REQ-ACT-009** — El sistema debe permitir eliminar una actividad.  
**REQ-ACT-010** — El sistema debe permitir reordenar actividades dentro del tablero del día.  
**REQ-ACT-011** — El usuario debe poder indicar si una actividad cuenta o no para el porcentaje de cumplimiento.


### 6.6 Tipos de seguimiento y estados de cumplimiento

**REQ-TRK-001** — El MVP debe soportar los siguientes tipos de seguimiento para una actividad:
- **Confirmación completa:** el usuario marca la actividad como hecha o no hecha.
- **Duración realizada:** el usuario registra cuántos minutos dedicó.
- **Cantidad realizada:** el usuario registra un número (p. ej. series, vasos de agua).
- **Porcentaje manual:** el usuario ingresa directamente un porcentaje de cumplimiento.

**REQ-TRK-002** — Una actividad puede tener los siguientes estados de cumplimiento:
- **Pendiente:** no se ha registrado ningún cumplimiento.
- **Parcial:** se registró cumplimiento incompleto.
- **Completo:** se registró cumplimiento total.
- **Justificado / Excluido:** el usuario indicó una razón por la que la actividad no aplica ese día.

**REQ-TRK-003** — El cambio de estado de cumplimiento debe reflejarse inmediatamente en el porcentaje del día.

### 6.7 Pantalla Hoy

**REQ-TODAY-001** — La pantalla Hoy debe mostrar: fecha actual, día actual del ciclo, porcentaje de cumplimiento del día, clasificación del día, minutos u horas programados, minutos u horas completados.  
**REQ-TODAY-002** — La pantalla Hoy debe mostrar las actividades del día ordenadas cronológicamente. Las actividades sin hora exacta deben aparecer en una sección separada.  
**REQ-TODAY-003** — Cada actividad en el tablero debe mostrar su nombre, categoría, horario (si tiene), estado de cumplimiento e indicación visual de si cuenta para el porcentaje.  
**REQ-TODAY-004** — El sistema debe mostrar cuál es la próxima actividad pendiente cuando sea posible determinarlo.  
**REQ-TODAY-005** — Desde la pantalla Hoy, el usuario debe poder marcar una actividad como completada.  
**REQ-TODAY-006** — Desde la pantalla Hoy, el usuario debe poder registrar cumplimiento parcial de una actividad.  
**REQ-TODAY-007** — Desde la pantalla Hoy, el usuario debe poder abrir el detalle de una actividad.  
**REQ-TODAY-008** — Desde la pantalla Hoy, el usuario debe poder editar una actividad.  
**REQ-TODAY-009** — Desde la pantalla Hoy, el usuario debe poder justificar o excluir una actividad.  
**REQ-TODAY-010** — Desde la pantalla Hoy, el usuario debe poder crear una nueva actividad.  
**REQ-TODAY-011** — La pantalla Hoy debe mostrar un acceso visual etiquetado como "Agregar por voz — Próximamente". Este acceso no tendrá funcionalidad de voz durante el MVP y puede mostrar un mensaje informativo al tocarlo.


### 6.8 Pantalla Semana

**REQ-WEEK-001** — La pantalla Semana debe permitir al usuario consultar los siete días de la semana actual.  
**REQ-WEEK-002** — El usuario debe poder navegar entre días dentro de la vista semanal.  
**REQ-WEEK-003** — La pantalla debe mostrar las actividades y horarios de cada día consultado.  
**REQ-WEEK-004** — La vista debe permitir identificar visualmente actividades completadas, parciales y pendientes.  
**REQ-WEEK-005** — Desde la pantalla Semana, el usuario debe poder abrir el detalle de una actividad.  
**REQ-WEEK-006** — Desde la pantalla Semana, el usuario debe poder crear una nueva actividad.  
**REQ-WEEK-007** — Desde la pantalla Semana, el usuario debe poder editar una actividad.  
**REQ-WEEK-008** — La versión móvil puede utilizar una vista de lista o agenda compacta. La versión web puede aprovechar el espacio adicional disponible. Arrastrar y soltar no es requisito del MVP.

### 6.9 Rutinas

**REQ-ROUT-001** — El usuario debe poder consultar su rutina activa y ver las actividades recurrentes que la componen.  
**REQ-ROUT-002** — El usuario debe poder modificar los días y horarios de las actividades de su rutina.  
**REQ-ROUT-003** — El usuario debe poder crear una rutina desde cero o a partir de una plantilla.  
**REQ-ROUT-004** — El usuario debe poder activar o desactivar actividades individuales dentro de su rutina.  
**REQ-ROUT-005** — El usuario debe poder consultar la lista de actividades inactivas.  
**REQ-ROUT-006** — El modelo de datos debe quedar preparado para que un usuario tenga múltiples rutinas en el futuro. El MVP puede limitar la interfaz a una rutina activa por usuario.

### 6.10 Ciclos de objetivos

**REQ-CYCLE-001** — El usuario debe poder definir un ciclo con fecha de inicio y duración.  
**REQ-CYCLE-002** — El sistema debe mostrar el día actual del ciclo (p. ej. "Día 14 de 90").  
**REQ-CYCLE-003** — El sistema debe mostrar los días restantes del ciclo actual.  
**REQ-CYCLE-004** — El usuario debe poder finalizar un ciclo manualmente antes de que expire.  
**REQ-CYCLE-005** — El usuario debe poder iniciar un nuevo ciclo después de que el anterior finalice.  
**REQ-CYCLE-006** — Finalizar un ciclo no debe eliminar el historial de cumplimiento del ciclo anterior.  
**REQ-CYCLE-007** — La duración del ciclo no debe estar limitada permanentemente a 90 días. Debe ser configurable.


### 6.11 Cálculo del cumplimiento diario

**REQ-SCORE-001** — El porcentaje de cumplimiento diario se calcula con la siguiente fórmula conceptual:

```
porcentaje = (puntos obtenidos / puntos programados) × 100
```

**REQ-SCORE-002** — Solo cuentan para el cálculo las actividades programadas para la fecha calculada y marcadas como participantes en puntuación.  
**REQ-SCORE-003** — Una actividad no programada para ese día no penaliza ni suma al porcentaje.  
**REQ-SCORE-004** — El cumplimiento parcial aporta proporcionalmente al numerador según el tipo de seguimiento registrado.  
**REQ-SCORE-005** — Una actividad justificada o excluida puede excluirse del denominador del cálculo; el diseño técnico definirá la regla exacta.  
**REQ-SCORE-006** — Las actividades desactivadas no participan en el cálculo del día.  
**REQ-SCORE-007** — Las actividades informativas (que no cuentan para el porcentaje) son visibles en el tablero pero no modifican el porcentaje.  
**REQ-SCORE-008** — Los pesos del día deben normalizarse de forma que el resultado final sea siempre un número entre 0 y 100.  
**REQ-SCORE-009** — Un día sin actividades puntuables no debe producir división por cero. El sistema debe manejar este caso con un resultado definido (p. ej. 0 % o "sin datos").  
**REQ-SCORE-010** — El cálculo del cumplimiento debe ser idéntico en las plataformas móvil y web. La lógica de cálculo debe residir en `src/domain/`.

### 6.12 Clasificación diaria

**REQ-CLASS-001** — El sistema debe asignar una clasificación al día según el porcentaje de cumplimiento:

| Rango | Clasificación |
|---|---|
| 80 % – 100 % | Día completo |
| 60 % – 79,99 % | Día aceptable |
| 40 % – 59,99 % | Día mínimo |
| 0 % – 39,99 % | Día perdido |

**REQ-CLASS-002** — Los umbrales de clasificación deben estar definidos en un único lugar centralizado (p. ej. `src/domain/` o `src/constants/`). Ningún componente visual debe contener estos valores literales.  
**REQ-CLASS-003** — La clasificación del día debe mostrarse en la pantalla Hoy, en el resumen del día y en el progreso semanal.


### 6.13 Progreso e historial

**REQ-PROG-001** — El sistema debe mostrar al usuario su porcentaje de cumplimiento de cada día.  
**REQ-PROG-002** — El sistema debe mostrar el promedio de cumplimiento de la semana actual.  
**REQ-PROG-003** — El sistema debe mostrar la cantidad de días completos, aceptables, mínimos y perdidos de la semana.  
**REQ-PROG-004** — El sistema debe mostrar la racha actual del usuario (días consecutivos que alcanzaron una clasificación mínima definida).  
**REQ-PROG-005** — El sistema debe mostrar las horas o minutos programados y realizados de la semana.  
**REQ-PROG-006** — El sistema debe mostrar el cumplimiento agrupado por categoría.  
**REQ-PROG-007** — El sistema debe permitir consultar días anteriores y su historial de actividades y cumplimiento.  
**REQ-PROG-008** — El MVP puede mostrar esta información mediante tarjetas y barras simples. No se requiere una librería avanzada de gráficos.

### 6.14 Actividades informativas

**REQ-INFO-001** — El usuario debe poder crear actividades de tipo informativo: comidas, suplementos, pausas, sueño u otras.  
**REQ-INFO-002** — El usuario debe poder decidir individualmente si una actividad informativa cuenta para el porcentaje, cuenta mediante una evaluación agregada, o es únicamente informativa sin afectar el porcentaje.  
**REQ-INFO-003** — No se debe imponer que cada comida o suplemento tenga un peso independiente obligatorio. El usuario define la configuración.

### 6.15 Diseño adaptable y navegación

**REQ-UI-001** — La aplicación debe ser mobile-first: los flujos principales se diseñan y validan primero para pantallas pequeñas (iPhone y Android).  
**REQ-UI-002** — La aplicación debe funcionar correctamente en iPhone, Android y navegador web.  
**REQ-UI-003** — Los controles táctiles deben tener un área mínima cómoda para interacción con el dedo.  
**REQ-UI-004** — El texto debe ser legible en todas las plataformas soportadas.  
**REQ-UI-005** — La interfaz debe responder correctamente a diferentes anchos de pantalla.  
**REQ-UI-006** — En móvil, la navegación principal debe utilizar una barra de navegación inferior.  
**REQ-UI-007** — En escritorio web, la navegación principal puede utilizar una barra lateral.  
**REQ-UI-008** — La identidad visual debe ser coherente entre plataformas. Los valores base aprobados son:
  - Color principal aproximado: `#2563EB`
  - Fondo claro aproximado: `#F8FAFC`
  - Texto principal aproximado: `#0F172A`
  - Los valores definitivos se documentarán en `design.md`.
**REQ-UI-009** — Todos los textos visibles en la interfaz deben estar en español. El código fuente, nombres de archivos y comentarios deben estar en inglés.


### 6.16 Seguridad y privacidad

**REQ-SEC-001** — Cada usuario debe acceder únicamente a sus propios datos. Ningún usuario debe poder leer ni modificar registros de otro usuario.  
**REQ-SEC-002** — Las operaciones de lectura y escritura sobre datos personales deben estar protegidas en el backend mediante Row Level Security (RLS) en Supabase.  
**REQ-SEC-003** — La seguridad no debe depender únicamente de filtros aplicados en el frontend.  
**REQ-SEC-004** — Todas las tablas con datos personales deben tener una columna `user_id` vinculada al usuario autenticado.  
**REQ-SEC-005** — RLS debe estar activo y configurado en todas las tablas de Supabase antes de que cualquier dato de usuario sea escrito.  
**REQ-SEC-006** — La clave `service_role` de Supabase no debe utilizarse en la aplicación cliente bajo ninguna circunstancia.  
**REQ-SEC-007** — Ningún secreto (claves de API, contraseñas, tokens) debe almacenarse en el repositorio de código.  
**REQ-SEC-008** — La sesión del usuario debe manejarse de manera segura, con tokens almacenados en almacenamiento seguro del dispositivo cuando esté disponible.  
**REQ-SEC-009** — La arquitectura debe permitir la eliminación de la cuenta y todos sus datos asociados en una etapa futura.

### 6.17 Estado sin conexión y manejo de errores

**REQ-ERR-001** — El MVP no requiere sincronización offline completa.  
**REQ-ERR-002** — El sistema debe mostrar indicadores de carga mientras espera respuestas del backend.  
**REQ-ERR-003** — El sistema debe mostrar mensajes de error comprensibles para el usuario cuando una operación falla.  
**REQ-ERR-004** — El sistema debe prevenir el registro duplicado de cumplimiento ante múltiples pulsaciones rápidas (protección contra doble envío).  
**REQ-ERR-005** — El sistema debe manejar fallos de red sin crashear ni mostrar datos incoherentes.  
**REQ-ERR-006** — El usuario debe poder reintentar una operación que falló por red.  
**REQ-ERR-007** — El sistema no debe mostrar bajo ninguna circunstancia datos pertenecientes a otro usuario.  
**REQ-ERR-008** — Cuando un usuario no tiene actividades programadas para el día, el sistema debe mostrar una experiencia estable y orientadora (p. ej. mensaje vacío con opción de crear actividad).

### 6.18 Preparación futura para voz

**REQ-VOICE-001** — La funcionalidad de voz no se implementa en el MVP.  
**REQ-VOICE-002** — La arquitectura de creación y edición de actividades debe diseñarse de forma que, en el futuro, una instrucción por voz pueda: crear actividades, editar actividades, mover actividades, registrar cumplimiento, consultar actividades pendientes y detectar conflictos de horario.  
**REQ-VOICE-003** — El flujo futuro de voz deberá seguir este orden: voz → transcripción → interpretación → borrador estructurado → validación → detección de conflictos → confirmación → guardado.  
**REQ-VOICE-004** — Nunca se guardará una interpretación de voz sin confirmación explícita del usuario.  
**REQ-VOICE-005** — La creación manual, la creación desde plantilla y la creación futura por voz deben poder compartir la misma lógica de dominio sin duplicar reglas de negocio.


---

## 7. Criterios de aceptación

### Autenticación

**CA-AUTH-001**  
CUANDO un usuario nuevo completa el formulario de registro con credenciales válidas,  
EL SISTEMA DEBERÁ crear la cuenta, iniciar sesión automáticamente y redirigir al flujo de onboarding.

**CA-AUTH-002**  
CUANDO un usuario registrado ingresa credenciales correctas,  
EL SISTEMA DEBERÁ iniciar sesión y redirigir a la pantalla Hoy.

**CA-AUTH-003**  
CUANDO el usuario cierra la aplicación y la vuelve a abrir con una sesión válida,  
EL SISTEMA DEBERÁ restaurar la sesión sin solicitar credenciales nuevamente.

**CA-AUTH-004**  
CUANDO el usuario toca "Cerrar sesión",  
EL SISTEMA DEBERÁ eliminar la sesión activa y redirigir a la pantalla de inicio de sesión.

**CA-AUTH-005**  
CUANDO el usuario solicita recuperar su acceso,  
EL SISTEMA DEBERÁ enviar un mecanismo de recuperación compatible con Supabase Auth al correo registrado.

### Onboarding

**CA-ONB-001**  
CUANDO un usuario completa el onboarding por primera vez,  
EL SISTEMA DEBERÁ marcar el onboarding como completado y no volver a mostrarlo al iniciar sesión en el futuro.

**CA-ONB-002**  
CUANDO el usuario selecciona una plantilla en el onboarding,  
EL SISTEMA DEBERÁ copiar las actividades de la plantilla como registros propios del usuario.

**CA-ONB-003**  
CUANDO el usuario selecciona "tablero vacío" en el onboarding,  
EL SISTEMA DEBERÁ completar el onboarding sin crear ninguna actividad preconfigurada.

### Pantalla Hoy

**CA-TODAY-001**  
CUANDO el usuario abre la pantalla Hoy,  
EL SISTEMA DEBERÁ mostrar la fecha actual, el día del ciclo, el porcentaje de cumplimiento y la lista de actividades del día ordenadas cronológicamente.

**CA-TODAY-002**  
CUANDO el usuario marca una actividad como completada,  
EL SISTEMA DEBERÁ actualizar el estado de la actividad y recalcular el porcentaje de cumplimiento del día en tiempo real.

**CA-TODAY-003**  
CUANDO el usuario registra cumplimiento parcial de una actividad,  
EL SISTEMA DEBERÁ reflejar el estado parcial y aportar proporcionalmente al porcentaje del día.

**CA-TODAY-004**  
CUANDO el usuario justifica o excluye una actividad,  
EL SISTEMA DEBERÁ excluirla del denominador del cálculo y recalcular el porcentaje.

**CA-TODAY-005**  
CUANDO no hay actividades programadas para el día,  
EL SISTEMA DEBERÁ mostrar un estado vacío con una opción para crear una actividad nueva.

### Cálculo y clasificación

**CA-SCORE-001**  
CUANDO el porcentaje de cumplimiento del día se calcula con actividades de distinto peso,  
EL SISTEMA DEBERÁ producir un resultado entre 0 y 100 sin división por cero.

**CA-SCORE-002**  
CUANDO una actividad desactivada existe en la base de datos para el día,  
EL SISTEMA DEBERÁ excluirla del cálculo de cumplimiento.

**CA-CLASS-001**  
CUANDO el porcentaje de cumplimiento del día es 80 % o superior,  
EL SISTEMA DEBERÁ mostrar la clasificación "Día completo".

**CA-CLASS-002**  
CUANDO el porcentaje de cumplimiento del día está entre 60 % y 79,99 %,  
EL SISTEMA DEBERÁ mostrar la clasificación "Día aceptable".

**CA-CLASS-003**  
CUANDO el porcentaje de cumplimiento del día está entre 40 % y 59,99 %,  
EL SISTEMA DEBERÁ mostrar la clasificación "Día mínimo".

**CA-CLASS-004**  
CUANDO el porcentaje de cumplimiento del día es inferior a 40 %,  
EL SISTEMA DEBERÁ mostrar la clasificación "Día perdido".

### Seguridad

**CA-SEC-001**  
CUANDO el usuario A intenta acceder a datos del usuario B mediante cualquier operación de la aplicación,  
EL SISTEMA DEBERÁ denegar el acceso y no retornar datos del usuario B.

**CA-SEC-002**  
CUANDO se realiza una operación de escritura sobre datos personales,  
EL SISTEMA DEBERÁ verificar la identidad del usuario mediante la política RLS de Supabase antes de confirmar la escritura.


---

## 8. Requisitos no funcionales

**REQ-NF-001 — Rendimiento:** El porcentaje de cumplimiento debe recalcularse y reflejarse en pantalla en menos de 500 ms tras registrar el cumplimiento de una actividad, bajo condiciones normales de red.

**REQ-NF-002 — Disponibilidad:** La disponibilidad de la aplicación depende de la disponibilidad de Supabase. No se requiere infraestructura propia de alta disponibilidad en el MVP.

**REQ-NF-003 — Compatibilidad:** La aplicación debe funcionar en iOS 16 o superior, Android 10 o superior, y en los navegadores modernos (Chrome, Safari, Firefox y Edge en sus versiones actuales).

**REQ-NF-004 — Escalabilidad del modelo de datos:** El esquema de base de datos debe soportar múltiples usuarios desde el inicio. Ninguna tabla o relación debe asumir un único usuario.

**REQ-NF-005 — Mantenibilidad:** La lógica de negocio (cálculo de cumplimiento, clasificación, manejo de ciclos) debe residir en `src/domain/` y ser independiente de React, Expo y Supabase para facilitar pruebas y cambios futuros.

**REQ-NF-006 — Internacionalización:** El MVP opera en español. La arquitectura no debe impedir agregar otros idiomas en el futuro, pero la internacionalización completa no es un requisito del MVP.

**REQ-NF-007 — Accesibilidad:** Los controles interactivos deben tener etiquetas de accesibilidad apropiadas. El MVP no requiere cumplimiento formal de WCAG, pero no debe crear barreras innecesarias.

**REQ-NF-008 — Seguridad de datos:** Ningún dato personal del usuario debe transmitirse a terceros no declarados. Las variables de entorno con claves de Supabase deben usar el prefijo `EXPO_PUBLIC_` y no deben contener `service_role`.

**REQ-NF-009 — TypeScript:** Todo el código nuevo debe estar escrito en TypeScript con strict mode habilitado. El uso de `any` debe evitarse y, cuando sea inevitable, documentarse con un comentario.

**REQ-NF-010 — Builds móviles:** Los builds de iOS y Android se realizan exclusivamente mediante EAS Build. No se utilizará Xcode local ni ningún comando de compilación local.


---

## 9. Reglas de negocio

**RN-001** — Una actividad desactivada no aparece en el tablero del día ni en el cálculo de cumplimiento, pero su historial se conserva.

**RN-002** — Una actividad que no cuenta para el porcentaje es visible en el tablero pero su cumplimiento no modifica el porcentaje del día.

**RN-003** — El cumplimiento parcial aporta al numerador de forma proporcional según el tipo de seguimiento:
- Confirmación completa: 0 % si no se marcó, 100 % si se completó.
- Duración realizada: `(minutos realizados / minutos objetivo) × peso`.
- Cantidad realizada: `(cantidad realizada / cantidad objetivo) × peso`.
- Porcentaje manual: el valor ingresado directamente.

**RN-004** — El cálculo del día considera únicamente actividades programadas para esa fecha específica según sus días de la semana, fecha de inicio y fecha de finalización.

**RN-005** — Si el denominador del cálculo es cero (no hay actividades puntuables), el sistema no produce un error; retorna un valor definido (pendiente de resolución en la pregunta abierta QA-005).

**RN-006** — Los umbrales de clasificación diaria (80 %, 60 %, 40 %) son globales y centralizados. Ningún componente de interfaz debe contener estos valores literales.

**RN-007** — Una plantilla copiada a un usuario crea registros independientes. Cambios posteriores en la plantilla global no afectan las actividades ya copiadas.

**RN-008** — El ciclo actual del usuario es el que tiene fecha de inicio más reciente y no ha sido finalizado. Un usuario sin ciclo activo puede ver su historial pero no verá el contador de "Día N de X".

**RN-009** — La zona horaria del usuario se usa para determinar qué fecha es "hoy" y qué actividades corresponden al día. El sistema no debe usar la zona horaria del servidor como referencia para el usuario.

**RN-010** — Las actividades con conflicto de horario (solapamiento) son visualmente identificables pero no bloqueadas en el MVP. El sistema puede mostrar una advertencia sin impedir el guardado.

**RN-011** — La plantilla inicial se carga desde Supabase y se copia a registros del usuario. No debe estar codificada en el cliente.

**RN-012** — El acceso "Agregar por voz — Próximamente" no debe ejecutar ninguna lógica de voz ni transcripción en el MVP. Puede mostrar un mensaje informativo al tocarlo.


---

## 10. Casos límite

**CL-001 — Día sin actividades puntuables:** Si el usuario no tiene ninguna actividad que cuente para el porcentaje en un día dado, el cálculo no debe producir división por cero. El tratamiento exacto queda pendiente (ver QA-005).

**CL-002 — Actividad que cruza medianoche:** Una actividad con hora de inicio antes de medianoche y hora de finalización después de medianoche debe asignarse al día en que comienza o al día en que termina. La regla exacta queda pendiente (ver QA-008).

**CL-003 — Cambio de zona horaria:** Si el usuario cambia su zona horaria después de haber registrado datos, el sistema debe manejar la transición sin corromper el historial ni duplicar actividades del día. La regla exacta queda pendiente (ver QA-009).

**CL-004 — Múltiples pulsaciones rápidas:** Si el usuario pulsa el botón de marcar cumplimiento varias veces en rápida sucesión, el sistema debe registrar el estado una sola vez y no crear entradas duplicadas en la base de datos.

**CL-005 — Actividad recurrente modificada:** Si el usuario edita una actividad recurrente (p. ej. cambia el horario), el sistema debe aclarar si el cambio aplica a todas las ocurrencias futuras o solo a la del día seleccionado. Este comportamiento se definirá en `design.md`.

**CL-006 — Ciclo sin fecha de finalización configurada:** Si el usuario no define una duración de ciclo explícita, el sistema no debe crashear. Puede mostrar el día absoluto desde el inicio sin indicar "días restantes".

**CL-007 — Primer día sin historial:** La pantalla de progreso semanal debe funcionar correctamente cuando el usuario no tiene historial de días anteriores en la semana visible.

**CL-008 — Plantilla vacía:** Si la plantilla inicial no contiene actividades (caso extremo), el sistema debe comportarse igual que si el usuario eligió "tablero vacío".

**CL-009 — Usuario sin ciclo activo:** Si el usuario no ha definido un ciclo, la pantalla Hoy debe funcionar correctamente sin mostrar "Día N de X". El resto de la funcionalidad no debe bloquearse.

**CL-010 — Eliminación de categoría con actividades:** Si el usuario intenta desactivar o eliminar una categoría que tiene actividades asignadas, el sistema debe definir el comportamiento (conservar la categoría en las actividades existentes o mostrar advertencia). Este comportamiento se definirá en `design.md`.


---

## 11. Fuera del alcance del MVP

Los siguientes elementos están explícitamente excluidos del MVP de EnFoco:

- Funcionalidad de voz (transcripción, interpretación y guardado por voz).
- Inteligencia artificial para reorganizar automáticamente el horario.
- Notificaciones push y recordatorios automáticos.
- Integración con Google Calendar o Apple Calendar.
- Arrastrar y soltar actividades en el tablero.
- Widgets nativos para iOS o Android.
- Modo oscuro.
- Facebook Login.
- Exportación de datos en PDF o Excel.
- Colaboración entre usuarios o rutinas compartidas.
- Funciones de redes sociales o comunidad.
- Gamificación compleja (puntos, insignias, tablas de clasificación).
- Suscripciones, planes de pago o compras dentro de la aplicación.
- Panel administrativo o de gestión de contenidos.
- Análisis predictivo o recomendaciones automáticas.
- Registro detallado de series y pesos del gimnasio como módulo independiente.
- Xcode local o compilaciones locales de iOS y Android.
- Análisis avanzado con librería de gráficos compleja.
- Historial de más de una semana en la interfaz de progreso (el modelo de datos lo soportará, pero la interfaz del MVP mostrará la semana actual).

---

## 12. Dependencias y supuestos

### Dependencias técnicas

- **Supabase:** El MVP depende de Supabase para autenticación, base de datos y RLS. Supabase no está configurado en esta etapa y se integrará en una etapa posterior definida en `tasks.md`.
- **EAS Build:** Los builds móviles dependen de EAS Build. Xcode local no está disponible y no se utilizará.
- **Expo SDK 54:** La aplicación está construida sobre Expo SDK `~54.0.35`. Actualizaciones de SDK se gestionarán como tareas separadas.
- **Node.js 24:** El entorno de desarrollo requiere Node.js 24 definido en `.nvmrc` y cargado mediante `source ~/.bash_profile`.

### Supuestos del producto

- El primer usuario real del MVP será Kevin, pero el sistema debe ser multiusuario desde el inicio del desarrollo.
- La plantilla inicial existirá en Supabase antes del primer despliegue de producción.
- La zona horaria del usuario se configurará durante el onboarding y podrá modificarse posteriormente.
- El MVP opera en español. La arquitectura no impide agregar idiomas en el futuro.
- El sistema de pesos o prioridades de actividades se definirá en `design.md` con la participación del usuario.

### Supuestos de infraestructura

- La aplicación se distribuirá inicialmente mediante Expo Go para pruebas y mediante EAS Build para distribución.
- No se requiere un dominio propio para la versión web en el MVP; puede operar en el subdominio provisto por el hosting elegido.


---

## 13. Preguntas abiertas

Las siguientes preguntas deben resolverse antes de redactar `design.md`. No bloquean la aprobación de este documento de requisitos.

| ID | Pregunta | Impacto |
|---|---|---|
| **QA-001** | ¿Cuál será el método inicial exacto de autenticación? (correo/contraseña, magic link, otro) | Diseño del flujo de auth y pantallas de login/registro. |
| **QA-002** | ¿Qué duraciones de ciclo estarán disponibles en el onboarding? (p. ej. 30, 60, 90 días o cualquier número) | Diseño del selector de ciclo en el onboarding. |
| **QA-003** | ¿Cómo se define el peso de una actividad en la interfaz? ¿El usuario ingresa un número, elige una prioridad o el peso es implícito por duración? | Diseño del formulario de actividad y fórmula de cálculo exacta. |
| **QA-004** | ¿Los pesos se expresan mediante puntos numéricos, niveles de prioridad (alta/media/baja) o porcentaje asignado manualmente? | Implementación de `REQ-SCORE-001` y normalización de pesos. |
| **QA-005** | ¿Cuál es el tratamiento exacto de un día sin actividades puntuables? ¿Se muestra 0 %, "sin datos" o se omite del historial? | Implementación de `REQ-SCORE-009` y `CL-001`. |
| **QA-006** | ¿Cuál es la regla exacta para calcular la racha? ¿Qué clasificación mínima se requiere para mantenerla (p. ej. Día aceptable o superior)? | Implementación de `REQ-PROG-004`. |
| **QA-007** | ¿Una actividad justificada mantiene la racha o la rompe? | Impacta la regla de negocio de racha y la percepción de "día válido". |
| **QA-008** | ¿Cómo se manejan las actividades que cruzan medianoche? ¿Pertenecen al día en que inician o al día en que finalizan? | Implementación de `CL-002` y cálculo de actividades del día. |
| **QA-009** | ¿Qué sucede con el historial si el usuario cambia su zona horaria después de haber registrado datos? | Implementación de `CL-003` y consultas de historial. |
| **QA-010** | ¿Qué actividades exactas incluirá la plantilla inicial que se almacenará en Supabase? | Creación de la migración de datos semilla. |
| **QA-011** | ¿La nutrición se registrará por actividad individual (p. ej. cada comida) o mediante una evaluación agregada del día (p. ej. "nutrición del día")? | Diseño del flujo de actividades informativas. |
| **QA-012** | ¿Qué estadísticas exactas formarán parte del primer dashboard web? ¿Solo la semana actual o también el ciclo completo? | Alcance de la pantalla de progreso en web. |
| **QA-013** | ¿El usuario podrá tener varias rutinas activas simultáneamente en el MVP, o se limita a una rutina activa? | Diseño del módulo de rutinas e interfaz de selección. |
| **QA-014** | ¿Cuál es la política inicial para eliminar una cuenta y todos sus datos asociados? | Diseño de la pantalla de perfil y migración de borrado. |
| **QA-015** | ¿Cuál es el alcance real de la experiencia web en la primera publicación? ¿Todas las pantallas del MVP o un subconjunto? | Priorización de tareas y diseño de layouts web. |


---

## 14. Índice de requisitos

### Autenticación (AUTH)
REQ-AUTH-001 · REQ-AUTH-002 · REQ-AUTH-003 · REQ-AUTH-004 · REQ-AUTH-005 · REQ-AUTH-006 · REQ-AUTH-007 · REQ-AUTH-008

### Onboarding (ONB)
REQ-ONB-001 · REQ-ONB-002 · REQ-ONB-003 · REQ-ONB-004 · REQ-ONB-005 · REQ-ONB-006 · REQ-ONB-007 · REQ-ONB-008

### Plantilla inicial (TPL)
REQ-TPL-001 · REQ-TPL-002 · REQ-TPL-003 · REQ-TPL-004 · REQ-TPL-005 · REQ-TPL-006

### Categorías (CAT)
REQ-CAT-001 · REQ-CAT-002 · REQ-CAT-003 · REQ-CAT-004 · REQ-CAT-005 · REQ-CAT-006

### Actividades (ACT)
REQ-ACT-001 · REQ-ACT-002 · REQ-ACT-003 · REQ-ACT-004 · REQ-ACT-005 · REQ-ACT-006 · REQ-ACT-007 · REQ-ACT-008 · REQ-ACT-009 · REQ-ACT-010 · REQ-ACT-011

### Tipos de seguimiento (TRK)
REQ-TRK-001 · REQ-TRK-002 · REQ-TRK-003

### Pantalla Hoy (TODAY)
REQ-TODAY-001 · REQ-TODAY-002 · REQ-TODAY-003 · REQ-TODAY-004 · REQ-TODAY-005 · REQ-TODAY-006 · REQ-TODAY-007 · REQ-TODAY-008 · REQ-TODAY-009 · REQ-TODAY-010 · REQ-TODAY-011

### Pantalla Semana (WEEK)
REQ-WEEK-001 · REQ-WEEK-002 · REQ-WEEK-003 · REQ-WEEK-004 · REQ-WEEK-005 · REQ-WEEK-006 · REQ-WEEK-007 · REQ-WEEK-008

### Rutinas (ROUT)
REQ-ROUT-001 · REQ-ROUT-002 · REQ-ROUT-003 · REQ-ROUT-004 · REQ-ROUT-005 · REQ-ROUT-006

### Ciclos (CYCLE)
REQ-CYCLE-001 · REQ-CYCLE-002 · REQ-CYCLE-003 · REQ-CYCLE-004 · REQ-CYCLE-005 · REQ-CYCLE-006 · REQ-CYCLE-007

### Puntuación / Cumplimiento (SCORE)
REQ-SCORE-001 · REQ-SCORE-002 · REQ-SCORE-003 · REQ-SCORE-004 · REQ-SCORE-005 · REQ-SCORE-006 · REQ-SCORE-007 · REQ-SCORE-008 · REQ-SCORE-009 · REQ-SCORE-010

### Clasificación diaria (CLASS)
REQ-CLASS-001 · REQ-CLASS-002 · REQ-CLASS-003

### Progreso e historial (PROG)
REQ-PROG-001 · REQ-PROG-002 · REQ-PROG-003 · REQ-PROG-004 · REQ-PROG-005 · REQ-PROG-006 · REQ-PROG-007 · REQ-PROG-008

### Actividades informativas (INFO)
REQ-INFO-001 · REQ-INFO-002 · REQ-INFO-003

### Diseño adaptable y navegación (UI)
REQ-UI-001 · REQ-UI-002 · REQ-UI-003 · REQ-UI-004 · REQ-UI-005 · REQ-UI-006 · REQ-UI-007 · REQ-UI-008 · REQ-UI-009

### Seguridad y privacidad (SEC)
REQ-SEC-001 · REQ-SEC-002 · REQ-SEC-003 · REQ-SEC-004 · REQ-SEC-005 · REQ-SEC-006 · REQ-SEC-007 · REQ-SEC-008 · REQ-SEC-009

### Errores y estado sin conexión (ERR)
REQ-ERR-001 · REQ-ERR-002 · REQ-ERR-003 · REQ-ERR-004 · REQ-ERR-005 · REQ-ERR-006 · REQ-ERR-007 · REQ-ERR-008

### Preparación para voz (VOICE)
REQ-VOICE-001 · REQ-VOICE-002 · REQ-VOICE-003 · REQ-VOICE-004 · REQ-VOICE-005

---

*Documento generado el 2026-07-26. Pendiente de revisión antes de continuar con `design.md`.*
