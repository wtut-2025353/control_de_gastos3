# Control de Gastos

## Descripción

Este proyecto es una aplicación web para llevar el control de los gastos personales. La idea es que el usuario pueda registrar sus ingresos y gastos, y llevar sus finanzas y presupuestos de forma más ordenada.

La aplicación todavía está en desarrollo, por el momento ya está terminada la parte del login, el dashboard con el resumen general y el formulario de ingresos.

## Tecnologías

Backend: Node.js, Express, TypeScript, MongoDB, JSON Web Tokens y login con Google.
Frontend: Angular, TypeScript, HTML y CSS.

## Requisitos

- Node.js (18 o superior)
- pnpm (8 o superior)
- MongoDB corriendo en local (o una URI de Mongo Atlas)

## Instalación

Guía corta para correr el proyecto en local.

### Paso 1: Clonar el repositorio

```
git clone https://github.com/wtut-2025353/control-de-gastos3
```

### Paso 2: Abrir una terminal

Puede ser la terminal del IDE o la de Windows, no importa.

### Paso 3: Entrar a la carpeta del proyecto

```
cd control-de-gastos
```

### Paso 4: Tener MongoDB corriendo

El proyecto usa la base `control_de_gastos`. Si usas Mongo local, solo revisa que el servicio esté iniciado. Si usas Atlas, guarda tu cadena de conexión para el siguiente paso.

### Paso 5: Configurar el .env del backend

En la carpeta `backend` hay un archivo `.env.example`, solo hay que copiarlo como `.env` y poner los datos propios:

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/control_de_gastos
JWT_SECRET=3513ac9b65b0430848227ad2fec1b6ed251b3b94dd0416efdcd2f161354b622e
JWT_EXPIRES_IN=3h
GOOGLE_CLIENT_ID=923643550096-kvgbige4bc3ms2khrr87o55gfbnqt63t.apps.googleusercontent.com
CLIENT_URL=http://localhost:4200
```

### Paso 6: Correr el backend

```
cd backend
pnpm install
pnpm run dev
```

Los datos de prueba se cargan solos al iniciar el servidor. El API queda en `http://localhost:3000`.

### Paso 7: Correr el frontend

En otra terminal, desde la raíz del proyecto:

```
cd frontend
pnpm install
pnpm start
```

### Paso 8: Abrir la app

Abrir en el navegador `http://localhost:4200` e iniciar sesión.
