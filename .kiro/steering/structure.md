# EnFoco — Structure Steering

## Estructura objetivo del proyecto

```
enfoco-app/
├── app/                        # Rutas y layouts de Expo Router (file-based routing)
│   ├── _layout.tsx             # Layout raíz
│   ├── (tabs)/                 # Grupo de rutas con tabs
│   │   ├── _layout.tsx
│   │   ├── index.tsx           # Hoy (today)
│   │   ├── week.tsx            # Semana
│   │   ├── progress.tsx        # Progreso
│   │   └── profile.tsx         # Perfil
│   └── ...                     # Otras rutas (auth, onboarding, etc.)
│
├── src/
│   ├── components/             # Componentes visuales reutilizables (UI pura)
│   │
│   ├── features/               # Features organizadas por dominio funcional
│   │   ├── auth/               # Autenticación (login, registro, sesión)
│   │   ├── onboarding/         # Flujo de bienvenida y configuración inicial
│   │   ├── activities/         # Creación y gestión de actividades individuales
│   │   ├── routines/           # Plantillas y rutinas dinámicas
│   │   ├── today/              # Tablero del día: ejecución y registro de cumplimiento
│   │   ├── week/               # Vista semanal y navegación por días
│   │   ├── progress/           # Métricas, clasificación y resumen de avance
│   │   └── profile/            # Datos del usuario y configuración de cuenta
│   │
│   ├── hooks/                  # Custom hooks reutilizables entre features
│   │
│   ├── lib/
│   │   └── supabase/           # Inicialización y cliente de Supabase (acceso centralizado)
│   │
│   ├── services/               # Comunicación con APIs y fuentes de datos externas
│   │
│   ├── domain/                 # Lógica de negocio pura: cálculos, reglas, transformaciones
│   │
│   ├── types/                  # Tipos e interfaces TypeScript compartidos entre features
│   │
│   └── utils/                  # Funciones auxiliares sin estado ni efectos secundarios
│
├── assets/                     # Imágenes, fuentes e íconos estáticos
├── constants/                  # Valores constantes de la aplicación (colores, tamaños, etc.)
├── .kiro/
│   └── steering/               # Archivos de contexto para Kiro
├── .nvmrc                      # Node.js 24
├── app.json
├── tsconfig.json
├── eslint.config.js
└── package.json
```

---

## Reglas por directorio

### `app/`

- Contiene **únicamente** rutas, layouts y puntos de entrada de Expo Router.
- No incluir lógica de negocio, cálculos ni acceso a datos directamente en las rutas.
- Las pantallas deben ser delgadas: obtener datos del hook correspondiente y renderizar componentes.
- Expo Router resuelve el enrutamiento por convención de archivos; respetar esa convención.

### `src/components/`

- Componentes visuales reutilizables, sin lógica de negocio propia.
- Deben ser pequeños y enfocados en un único propósito visual.
- No deben acceder directamente a Supabase ni a servicios externos.
- Pueden consumir props, context o custom hooks.

### `src/features/<feature>/`

Cada feature puede contener su propia estructura interna:

```
features/today/
├── components/       # Componentes específicos de esta feature
├── hooks/            # Hooks específicos de esta feature
├── services/         # Llamadas a datos específicas de esta feature (opcional)
├── types.ts          # Tipos locales de la feature (si no son compartidos)
└── index.ts          # Re-exportaciones públicas de la feature
```

- La lógica específica de una feature vive dentro de su carpeta.
- Lo que es reutilizable entre features sube a `src/hooks/`, `src/domain/` o `src/utils/`.

### `src/hooks/`

- Custom hooks reutilizables entre múltiples features.
- Pueden conectar UI con dominio, gestionar estado local o adaptar datos.
- No deben contener lógica de negocio pura (eso va en `domain/`).

### `src/lib/supabase/`

- Único lugar donde se inicializa y exporta el cliente de Supabase.
- Ningún componente, pantalla ni hook debe instanciar Supabase directamente.
- Cuando Supabase esté configurado, aquí se define el cliente tipado y las utilidades de auth.

### `src/services/`

- Funciones que se comunican con APIs externas o con Supabase.
- Devuelven datos procesados listos para consumir desde hooks o componentes.
- No deben contener lógica de UI ni de presentación.

### `src/domain/`

- Lógica de negocio pura: funciones sin efectos secundarios.
- Ejemplos: calcular porcentaje de cumplimiento, clasificar el día, validar una rutina.
- No debe importar React, hooks ni servicios externos.
- Es completamente testeable de forma aislada.

### `src/types/`

- Tipos e interfaces TypeScript compartidos entre dos o más features.
- Ejemplos: `Activity`, `Routine`, `DaySummary`, `User`.
- Los tipos locales de una sola feature permanecen dentro de la carpeta de esa feature.

### `src/utils/`

- Funciones auxiliares sin estado ni efectos secundarios.
- Ejemplos: formatear fechas, convertir duración, truncar texto.
- No deben depender de React ni de servicios.

---

## Actividades dinámicas

- Las actividades son completamente dinámicas: el usuario las crea, edita y elimina.
- **Prohibido** quemar actividades, rutinas o plantillas personales dentro de componentes o constantes.
- La plantilla inicial del día se almacenará posteriormente en Supabase y se cargará desde allí.

---

## Compartir entre plataformas

- Móvil (iOS y Android) y web comparten el mismo dominio, tipos y servicios.
- Los layouts y algunos componentes visuales pueden diferir entre plataformas.
- Usar archivos con extensión específica (`.web.tsx`, `.ios.tsx`, `.android.tsx`) **solo cuando exista una necesidad real y justificada**, no de forma preventiva.

---

## Estado actual del proyecto

La estructura actual del proyecto (generada por Expo) se mantiene intacta en esta etapa. La migración hacia la estructura objetivo descrita aquí se realizará de forma incremental, feature por feature, según avance el desarrollo.

**No reorganizar ni mover archivos existentes** hasta que una tarea específica lo requiera.
