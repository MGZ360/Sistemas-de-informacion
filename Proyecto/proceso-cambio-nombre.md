# Proceso de cambio de nombre desde el index

Este documento describe cómo el backend recibe y procesa el cambio de nombre enviado desde la tabla de usuarios de `index.ejs`.

## Flujo de la solicitud

1. **Carga del index.** La ruta `GET /` aplica `authController.isauthenticated` para exigir una sesión válida. Después consulta `id`, `name` y `email` de la tabla `Users`, y renderiza `index.ejs` con la lista de usuarios.

2. **Envío del formulario.** En cada fila, el formulario apunta a `POST /users/:id/name`. El valor `:id` se completa con el ID de ese usuario y el campo `name` contiene el nombre editado. El botón **Guardar** envía ambos datos.

3. **Lectura del formulario.** `express.urlencoded({ extended: true })`, registrado antes de las rutas en `app.js`, procesa los datos del formulario y los deja disponibles en `req.body`.

4. **Autenticación y validación.** La ruta vuelve a ejecutar `authController.isauthenticated`. Luego obtiene el nombre de `req.body.name`, elimina espacios al principio y al final con `trim()`, y convierte el ID de la URL a número. Si el ID no es un entero positivo, el nombre queda vacío o supera los 100 caracteres, redirige a `/` sin ejecutar la actualización.

5. **Actualización en la base de datos.** Si los datos pasan la validación, ejecuta:

   ```sql
   UPDATE Users SET name = ? WHERE id = ?
   ```

   El nombre y el ID se envían como parámetros separados (`[name, userId]`), en lugar de concatenarse en la consulta.

6. **Respuesta.** Si la consulta falla, el backend registra el error y responde con estado HTTP 500. Si se completa, redirige a `/?updated=1`.

7. **Confirmación en el index.** La ruta `GET /` vuelve a consultar la lista, por lo que el nombre actualizado aparece en la tabla. El parámetro `updated=1` se pasa a la vista como `updated: true`, y `index.ejs` muestra el mensaje de confirmación.

## Archivos involucrados

- `src/app.js`: configura el procesamiento de formularios y monta el router.
- `src/routes/router.js`: carga los usuarios y contiene la ruta POST que valida y actualiza el nombre.
- `src/views/index.ejs`: muestra la tabla, el formulario por usuario y el mensaje de confirmación.
- `src/controllers/authController.js`: proporciona el middleware de autenticación usado por las rutas.

## Consideración de autorización

La ruta requiere que la solicitud esté autenticada, pero actualmente no verifica que el ID recibido en la URL pertenezca al usuario autenticado. Por ello, cualquier usuario con una sesión válida podría cambiar el nombre de otro usuario si modifica el ID de la ruta.
