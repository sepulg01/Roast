# Aprobacion de copy - limpieza confirmacion transferencia

- Fecha: 2026-05-06
- Owner: Gonzalo
- Estado: APROBADO

## Alcance aprobado

- Eliminar las lineas duplicadas visibles bajo `Datos para transferencia` en la confirmacion del pedido.
- Mantener los datos bancarios solo como filas de la lista: `Banco`, `Tipo de cuenta`, `Número`, `Titular`, `RUT`, `Email` y `Vencimiento`.
- Usar `Vencimiento` como etiqueta de fila para la fecha limite de transferencia.
- Evitar derivar numeros visibles desde IDs internos `roast_*`; si no existe un numero `DDMMRRR` exacto, mostrar `pendiente`.
