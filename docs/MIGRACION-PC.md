# Continuar el proyecto desde otra PC

Proyecto: **Cobranza Tres Provincias**

## Repositorio

- GitHub: `norferdeposito-pixel/cobranza-tres-provincias`
- Rama de trabajo: `main`
- Producción: `https://cobranza-tres-provincias.vercel.app`

## Preparar una PC nueva

1. Instalar Git y Node.js LTS.
2. Clonar el repositorio:
   ```bash
   git clone https://github.com/norferdeposito-pixel/cobranza-tres-provincias.git
   cd cobranza-tres-provincias
   ```
3. Instalar dependencias:
   ```bash
   npm install
   ```
4. Verificar el proyecto:
   ```bash
   npm run build
   npm test
   ```
5. Iniciar desarrollo local:
   ```bash
   npm run dev
   ```

## Flujo de cambios

Antes de modificar:
```bash
git checkout main
git pull origin main
```

Después de modificar y verificar:
```bash
git add .
git commit -m "Descripcion del cambio"
git push origin main
```

Vercel está vinculado al repositorio y despliega los cambios de `main`.

## Datos online

Los datos operativos de Cobranza Tres Provincias se sincronizan con Supabase. No dependen del disco local de una PC. No copiar bases locales antiguas sobre una instalación nueva.

## Recomendaciones

- No trabajar sobre una copia vieja sin ejecutar antes `git pull origin main`.
- No guardar claves privadas ni contraseñas dentro del repositorio.
- Antes de cambios grandes, verificar que producción esté estable y crear un punto de respaldo en Git.
- Si una PC deja de usarse, cerrar sesión en GitHub, Vercel, correo y ChatGPT antes de entregarla.
