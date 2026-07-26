# EnFoco — Tech Steering

## Stack principal

| Capa              | Tecnología                                   |
|-------------------|----------------------------------------------|
| Framework móvil   | React Native (via Expo SDK 54)               |
| Framework web     | React Native Web                             |
| Enrutamiento      | Expo Router (file-based routing)             |
| Lenguaje          | TypeScript (strict mode)                     |
| Linter            | ESLint                                       |
| Runtime           | Node.js 24 (definido en `.nvmrc`)            |
| Backend (futuro)  | Supabase (PostgreSQL + Supabase Auth)        |
| Builds móviles    | EAS Build (Expo Application Services)       |

---

## Expo y React Native

- Usar **Expo SDK `~54.0.35`**.
- El punto de entrada es `expo-router/entry`.
- Instalar paquetes relacionados con Expo usando `npx expo install`, no `npm install` directamente.
- No instalar dependencias sin justificar su necesidad en la tarea o el diseño correspondiente.

### Comandos prohibidos

Los siguientes comandos **nunca deben ejecutarse** en este proyecto:

```bash
# Prohibido
expo run:ios
expo run:android
xcodebuild
pod install
expo prebuild
```

- **No crear manualmente** las carpetas `ios/` o `android/`.
- **Xcode local no está disponible** y está completamente descartado para este proyecto.
- Todos los builds de iOS y Android se realizan mediante **EAS Build** en la nube.

---

## Node.js

- La versión requerida es **Node.js 24**, declarada en `.nvmrc`.
- Para cargar NVM en la terminal integrada de Kiro usar:

```bash
source ~/.bash_profile
```

- **No usar** `source ~/.zshrc`.

---

## TypeScript

- Activar **strict mode** en `tsconfig.json`.
- Usar `import type` para importaciones de solo tipos.
- Evitar el uso de `any`. Si es necesario, documentar el motivo con un comentario.
- Los tipos e interfaces deben definirse en `src/types/` cuando sean compartidos entre features.
- Los tipos específicos de un feature pueden vivir dentro de su propio directorio.

---

## ESLint

- Ejecutar `npm run lint` para verificar el estilo del código.
- El linter debe pasar sin errores antes de hacer commit.
- No deshabilitar reglas de ESLint sin una justificación documentada.

---

## Supabase (backend futuro)

Supabase se integrará en una etapa posterior. En esta etapa **no se configura ni se instala**.

### Variables de entorno (cuando se configure)

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

- Estas variables serán públicas (prefijo `EXPO_PUBLIC_`) y seguras para incluir en el cliente.
- **Prohibido** usar la clave `service_role` en la aplicación cliente bajo ninguna circunstancia.
- **Prohibido** exponer secretos en el código fuente o en archivos versionados.

### Row Level Security (RLS)

- **RLS es obligatorio** en todas las tablas de Supabase.
- Ninguna tabla debe ser accesible sin políticas RLS activas.
- El acceso a datos debe respetar siempre el contexto del usuario autenticado.

### Centralización del cliente Supabase

- El cliente de Supabase debe inicializarse en un único lugar: `src/lib/supabase/`.
- Ningún componente ni pantalla debe inicializar Supabase directamente.

---

## Arquitectura y separación de responsabilidades

Mantener una separación clara entre las capas de la aplicación:

| Capa       | Responsabilidad                                                   |
|------------|-------------------------------------------------------------------|
| UI         | Componentes visuales, layouts, pantallas (sin lógica de negocio) |
| Domain     | Reglas de negocio, cálculos, transformaciones puras              |
| Services   | Comunicación con APIs externas (Supabase, etc.)                  |
| Hooks      | Estado local, efectos, adaptadores entre UI y dominio            |
| Utils      | Funciones auxiliares sin estado ni efectos secundarios           |

- La lógica de negocio **no debe vivir** directamente en los archivos de rutas (`app/`).
- Los componentes visuales deben ser pequeños y enfocados en presentación.
- No quemar datos hardcodeados (rutinas, actividades, plantillas) dentro de componentes.

---

## Pruebas automatizadas

No agregar pruebas automatizadas hasta que el flujo principal esté estable, **salvo que se solicite expresamente** en la tarea correspondiente.

---

## Archivos específicos por plataforma

Se permiten archivos con extensiones específicas de plataforma (`.web.tsx`, `.ios.tsx`, `.android.tsx`) **únicamente cuando exista una necesidad real y justificada**. No crearlos de forma preventiva.
