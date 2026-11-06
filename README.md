# ARINC Lab

Prototipo educativo en español para administrar instrumentos y generar palabras
ARINC 429 simuladas. No requiere instalar dependencias: abre `index.html` en un
navegador moderno. Los datos se guardan en el almacenamiento local del navegador.

## Funcionalidad

- CRUD de instrumentos con nombre, rango mínimo/máximo, label octal y SDI.
- Validación de que el mínimo sea menor que el máximo y de que los labels estén
  entre `000` y `377` en octal.
- CRUD de envíos: generar, editar, borrar y limpiar historial. Cada valor se
  valida contra el rango del instrumento.
- Vista hexadecimal y binaria de una palabra de 32 bits con label, SDI, dato,
  SSM y paridad impar.

## Suposiciones de la simulación

El label se ingresa en octal. Los 19 bits del campo de dato se calculan mediante
un mapeo lineal del rango configurado a `0..524287`; SSM se fija en `00` y la
paridad se calcula como impar. Este mapeo es una convención educativa del
prototipo, **no una codificación BNR universal ni una especificación de ningún
instrumento aeronáutico**. Para representar un instrumento real, hay que
configurar su palabra según la documentación correspondiente y validar el orden
de bits con el hardware.

La aplicación no transmite por puerto serial o ARINC 429 ni produce una salida
eléctrica. La integración física queda pendiente de la interfaz y del hardware
que se seleccionen.
