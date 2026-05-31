# Tareas de Implementación

## Tarea 1: Crear la función de transformación central

- [x] 1.1 Crear el archivo `integrations/angular-plugin.js`
- [x] 1.2 Implementar la función `transformBananaBox(content)` que recibe un string HTML y retorna el string transformado
- [x] 1.3 Implementar la regex que matchea `[(prop)]="expr"` solo en custom elements (tags con `-`)
- [x] 1.4 Implementar el loop para manejar múltiples banana-box en el mismo elemento
- [x] 1.5 Agregar exclusión explícita de `[(ngModel)]`
- [x] 1.6 Exportar la función `transformBananaBox` para poder testearla en aislamiento

### Criterios de Aceptación
- Req 1.1: WHEN el Plugin encuentra `[(prop)]="expr"` en un Custom_Element, THE Plugin SHALL transformarlo a `[prop]="expr" (propChange)="expr = $any($event).detail"`
- Req 1.2: WHEN el Plugin encuentra un Banana_Box en un elemento HTML nativo (sin guión en el tag), THE Plugin SHALL preservar el binding sin modificaciones
- Req 1.3: WHEN el Plugin encuentra `[(ngModel)]` en cualquier elemento, THE Plugin SHALL preservar el binding sin modificaciones
- Req 1.4: WHEN el Plugin procesa un Custom_Element con múltiples Banana_Box, THE Plugin SHALL transformar cada binding independientemente en el mismo elemento
- Req 5.1: WHEN el Plugin transforma un Banana_Box, THE Plugin SHALL preservar el nombre exacto de la propiedad en el output
- Req 5.2: WHEN el Plugin transforma un Banana_Box, THE Plugin SHALL preservar la expresión exacta del binding en el output
- Req 5.3: WHEN el Plugin transforma un Banana_Box, THE Plugin SHALL generar el sufijo `Change` concatenado al nombre de la propiedad para el evento

## Tarea 2: Crear tests unitarios para la función de transformación

- [x] 2.1 Crear el archivo de tests `tests/angular-plugin.test.js`
- [x] 2.2 Test: transforma banana-box simple en custom element (`[(count)]="val"` → `[count]="val" (countChange)="val = $any($event).detail"`)
- [x] 2.3 Test: NO transforma banana-box en elementos nativos (`<div [(prop)]="val">`)
- [x] 2.4 Test: NO transforma `[(ngModel)]` en ningún elemento
- [x] 2.5 Test: maneja múltiples banana-box en el mismo custom element
- [x] 2.6 Test: preserva atributos existentes del elemento sin modificación
- [x] 2.7 Test: retorna el contenido sin cambios si no hay banana-box en custom elements
- [x] 2.8 Test: maneja expresiones complejas en el binding (e.g., `obj.prop`, `arr[0]`)
- [x] 2.9 Test: la transformación es idempotente (aplicar dos veces = mismo resultado)

### Criterios de Aceptación
- Req 5.4: WHEN el Plugin transforma un Custom_Element con atributos existentes, THE Plugin SHALL preservar todos los demás atributos sin modificación
- Req 5.5: FOR ALL templates válidos, aplicar el Plugin y luego parsear el resultado SHALL producir un template Angular válido sintácticamente

## Tarea 3: Crear el wrapper del plugin de esbuild

- [x] 3.1 Implementar la función principal del plugin que retorna un objeto compatible con la API de plugins de esbuild
- [x] 3.2 Implementar el hook `onLoad` para archivos `.html` que aplica `transformBananaBox` al contenido completo
- [x] 3.3 Implementar el hook `onLoad` para archivos `.ts` que detecta `template:` inline y transforma solo el string del template
- [x] 3.4 Retornar `null` cuando no hay cambios (para no interferir con el pipeline)
- [x] 3.5 Usar el loader correcto (`text` para `.html`, `ts` para `.ts`) en el resultado

### Criterios de Aceptación
- Req 2.1: WHEN el Plugin procesa un archivo `.html` referenciado por `templateUrl`, THE Plugin SHALL aplicar la transformación de Banana_Box a todo el contenido del archivo
- Req 2.2: WHEN el Plugin procesa un archivo `.ts` con `template:` inline, THE Plugin SHALL aplicar la transformación de Banana_Box dentro del string del template
- Req 2.3: WHEN el Plugin procesa un archivo que no contiene Banana_Box en custom elements, THE Plugin SHALL retornar el contenido sin modificaciones
- Req 3.1: THE Plugin SHALL exportar una función compatible con la API de plugins de esbuild para Angular 17+
- Req 3.2: WHEN el Plugin se registra en `angular.json`, THE Plugin SHALL interceptar archivos `.html` y `.ts` durante el build
- Req 3.3: WHEN el Plugin está activo, THE Plugin SHALL procesar los archivos antes de que el compilador AOT de Angular los analice

## Tarea 4: Registrar el plugin en el proyecto Angular de integración

- [x] 4.1 Modificar `framework-integrations/angular/angular.json` para agregar el plugin en `architect.build.options.plugins`
- [x] 4.2 Copiar el archivo `integrations/angular-plugin.js` al directorio `src/wcc-components/` del proyecto Angular
- [x] 4.3 Verificar que el path en `angular.json` apunta correctamente al archivo copiado

### Criterios de Aceptación
- Req 3.2: WHEN el Plugin se registra en `angular.json` bajo `architect.build.options.plugins`, THE Plugin SHALL interceptar archivos `.html` y `.ts` durante el build
- Req 4.2: THE Plugin SHALL ser distribuido como un archivo independiente que no requiere dependencias adicionales

## Tarea 5: Actualizar la app Angular de test para eliminar uso de `wccModel`

- [x] 5.1 Modificar `framework-integrations/angular/src/app/app.component.html` para eliminar el atributo `wccModel` de los elementos con banana-box
- [x] 5.2 Modificar `framework-integrations/angular/src/app/app.component.ts` para eliminar el import de `WccModel` del array `imports`
- [x] 5.3 Mantener los tests existentes de two-way binding (Test 3 y Test 4) funcionando con la nueva transformación

### Criterios de Aceptación
- Req 4.1: WHILE la WccModel_Directive está importada en un componente, THE Plugin SHALL funcionar sin conflictos con la directiva
- Req 4.3: IF el Plugin no está registrado en `angular.json`, THEN THE WccModel_Directive SHALL seguir funcionando como fallback

## Tarea 6: Actualizar el CLI para copiar el nuevo archivo del plugin

- [x] 6.1 Modificar la función `copyIntegrationPlugin` en `bin/wcc.js` para incluir `angular-plugin.js` en la lista de archivos Angular
- [x] 6.2 Agregar la entrada `{ src: join(rootDir, 'integrations/angular-plugin.js'), dest: 'angular-plugin.js' }` al array de archivos Angular
- [x] 6.3 Verificar que el archivo se copia correctamente al directorio de salida

### Criterios de Aceptación
- Req 4.2: THE Plugin SHALL ser distribuido como un archivo independiente que no requiere dependencias adicionales

## Tarea 7: Test de integración — verificar build y ejecución

- [x] 7.1 Ejecutar `ng build` en el proyecto `framework-integrations/angular/` y verificar que compila sin errores
- [x] 7.2 Verificar que el two-way binding funciona correctamente sin la directiva `wccModel` (Test 3 y Test 4 del template)
- [x] 7.3 Verificar que los bindings unidireccionales y eventos siguen funcionando (Test 1 y Test 2)
- [x] 7.4 Verificar que `[(ngModel)]` en formularios nativos (si existieran) no se ve afectado
- [x] 7.5 Verificar que la app funciona tanto en modo development (`ng serve`) como en build de producción

### Criterios de Aceptación
- Req 1.1: La transformación produce el output correcto en runtime
- Req 1.2: Elementos nativos no son afectados
- Req 2.1: Templates externos son procesados correctamente
- Req 5.5: El resultado es un template Angular válido que compila sin errores
