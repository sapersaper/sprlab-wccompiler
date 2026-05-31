# Documento de Requisitos

## Introducción

Plugin de build para Angular que transforma automáticamente la sintaxis banana-box `[(prop)]` en custom elements WCC, eliminando la necesidad de importar y usar la directiva `WccModel`. El plugin intercepta los templates durante la compilación y reescribe los bindings para que `$event.detail` sea extraído correctamente, logrando two-way binding zero-config con componentes WCC.

## Glosario

- **Plugin**: Plugin de esbuild que se registra en `angular.json` y transforma templates HTML antes de la compilación AOT de Angular.
- **Banana_Box**: Sintaxis de Angular `[(prop)]="expr"` que se expande a `[prop]="expr" (propChange)="expr = $event"`.
- **Custom_Element**: Elemento HTML cuyo tag name contiene un guión (`-`), registrado via Custom Elements API.
- **Template_Externo**: Archivo `.html` referenciado por `templateUrl` en un componente Angular.
- **Template_Inline**: String de template definido directamente en la propiedad `template` del decorador `@Component`.
- **WccModel_Directive**: Directiva Angular existente que actúa como puente para two-way binding (fallback manual).

## Requisitos

### Requisito 1: Transformación de banana-box en custom elements

**User Story:** Como desarrollador Angular, quiero usar `[(prop)]="expr"` en custom elements WCC sin configuración adicional, para que el two-way binding funcione igual que con componentes nativos Angular.

#### Criterios de Aceptación

1. WHEN el Plugin encuentra `[(prop)]="expr"` en un Custom_Element, THE Plugin SHALL transformarlo a `[prop]="expr" (propChange)="expr = $any($event).detail"`
2. WHEN el Plugin encuentra un Banana_Box en un elemento HTML nativo (sin guión en el tag), THE Plugin SHALL preservar el binding sin modificaciones
3. WHEN el Plugin encuentra `[(ngModel)]` en cualquier elemento, THE Plugin SHALL preservar el binding sin modificaciones
4. WHEN el Plugin procesa un Custom_Element con múltiples Banana_Box, THE Plugin SHALL transformar cada binding independientemente en el mismo elemento

### Requisito 2: Procesamiento de templates

**User Story:** Como desarrollador Angular, quiero que el plugin procese tanto templates externos como inline, para que funcione independientemente de cómo defina mis componentes.

#### Criterios de Aceptación

1. WHEN el Plugin procesa un archivo `.html` referenciado por `templateUrl`, THE Plugin SHALL aplicar la transformación de Banana_Box a todo el contenido del archivo
2. WHEN el Plugin procesa un archivo `.ts` con `template:` inline (backticks o comillas), THE Plugin SHALL aplicar la transformación de Banana_Box dentro del string del template
3. WHEN el Plugin procesa un archivo que no contiene Banana_Box en custom elements, THE Plugin SHALL retornar el contenido sin modificaciones

### Requisito 3: Integración con el sistema de build de Angular

**User Story:** Como desarrollador Angular, quiero registrar el plugin en `angular.json` y que funcione automáticamente, para no tener que modificar mi código de componentes.

#### Criterios de Aceptación

1. THE Plugin SHALL exportar una función compatible con la API de plugins de esbuild para Angular 17+
2. WHEN el Plugin se registra en `angular.json` bajo `architect.build.options.plugins`, THE Plugin SHALL interceptar archivos `.html` y `.ts` durante el build
3. WHEN el Plugin está activo, THE Plugin SHALL procesar los archivos antes de que el compilador AOT de Angular los analice

### Requisito 4: Compatibilidad y coexistencia

**User Story:** Como desarrollador Angular, quiero que el plugin sea opcional y compatible con la directiva WccModel existente, para poder migrar gradualmente.

#### Criterios de Aceptación

1. WHILE la WccModel_Directive está importada en un componente, THE Plugin SHALL funcionar sin conflictos con la directiva
2. THE Plugin SHALL ser distribuido como un archivo independiente que no requiere dependencias adicionales
3. IF el Plugin no está registrado en `angular.json`, THEN THE WccModel_Directive SHALL seguir funcionando como fallback para two-way binding

### Requisito 5: Correctitud de la transformación regex

**User Story:** Como desarrollador Angular, quiero que la transformación preserve la semántica correcta del template, para que no se introduzcan errores en mi aplicación.

#### Criterios de Aceptación

1. WHEN el Plugin transforma un Banana_Box, THE Plugin SHALL preservar el nombre exacto de la propiedad en el output `[prop]` y `(propChange)`
2. WHEN el Plugin transforma un Banana_Box, THE Plugin SHALL preservar la expresión exacta del binding en el output
3. WHEN el Plugin transforma un Banana_Box, THE Plugin SHALL generar el sufijo `Change` concatenado al nombre de la propiedad para el evento
4. WHEN el Plugin transforma un Custom_Element con atributos existentes, THE Plugin SHALL preservar todos los demás atributos sin modificación
5. FOR ALL templates válidos, aplicar el Plugin y luego parsear el resultado SHALL producir un template Angular válido sintácticamente
