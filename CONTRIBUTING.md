# Cómo contribuir

Los issues y los pull requests son bienvenidos.

## Reportar un error o pedir un cambio

Abre un issue con el formulario de [reporte de error](https://github.com/veriko-mx-labs/veriko-api-collection/issues/new?template=bug_report.yml) o de [solicitud de mejora](https://github.com/veriko-mx-labs/veriko-api-collection/issues/new?template=feature_request.yml). Antes, busca entre los issues abiertos.

Un reporte de error necesita las versiones que usas, los pasos para reproducirlo y, cuando la API respondió con un error, su `request_id`. Quita las claves de API, los comprobantes, los números de cuenta y los datos de clientes de todo lo que pegues.

No abras un issue público para una vulnerabilidad de seguridad. Sigue [SECURITY.md](SECURITY.md).

## Proponer un cambio

1. Si el cambio es más grande que una corrección, abre antes un issue para acordarlo antes de escribirlo.
2. Haz un fork del repositorio y crea una rama desde `main`.
3. Haz el cambio. Agrega o actualiza la petición y mantén `npm test` en verde.
4. Corre las comprobaciones de este repositorio:

   ```bash
   npm ci
   npm run format:check
   npm test
   ```

   `npm run format` corrige el formato. `npm test` no envía ninguna petición ni necesita una clave de API. Usa Node.js 18 o posterior.

5. Actualiza README.md y CHANGELOG.md cuando cambie lo que ven quienes usan la colección.
6. Abre un pull request contra `main` y llena la plantilla.

Escribe los mensajes de commit en español, en imperativo, y deja un solo cambio por commit.

Después de cambiar un archivo `.bru`, corre `npm run gen:postman` y confirma los archivos regenerados de `postman/`. `npm run check:postman-fresh` falla cuando difieren de las peticiones `.bru`.

Escribe en español el texto de cada petición. Marca con la etiqueta `consumes-quota` la petición que consume cuota y con `destructive` la que modifica datos.

## El contrato de la API

El contrato de la API es el spec público en <https://docs.veriko.mx/openapi.yaml>. `spec/openapi.yaml` es una copia que sincroniza un workflow programado. No la edites a mano. Cuando la API se comporte distinto del spec, abre un issue.
