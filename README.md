# CleverDar

Agenda unificada (Google Calendar + iCloud), notificaciones y planificador de estudio.
Diseño completo en [`PLAN.md`](./PLAN.md).

## Desarrollo local

```bash
npm install
cp .env.example .env   # completar con los valores de Supabase
npm run dev
```

## Estado

- [x] Fase 0 (en curso): esqueleto, PWA, login, migración inicial, despliegue
- [ ] Fase 1: agenda unificada y notificaciones

## Configuración pendiente del dueño

1. Repositorio en GitHub con Pages activado (fuente: GitHub Actions).
2. Proyecto en Supabase; copiar URL y clave `anon` a los secretos del repositorio:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. Crear el usuario en Supabase Auth y desactivar el registro público.
4. Ejecutar `supabase/migrations/0001_init.sql` en el SQL Editor de Supabase.
