# Bug Fixing Process

## Bug Tracking System

### File Naming Convention

**Format**: `NNNN-[status]-[priority]-brief-description.md`

**Priority Levels**:
- ⏫ `highest` - Critical/Blocking - Breaks core functionality, immediate fix needed
- 🔼 `high` - Important - Significant impact, fix soon
- ↕️ `medium` - Moderate - Moderate impact, schedule appropriately
- 🔽 `low` - Minor - Minor issue, fix when convenient
- ⏬ `lowest` - Trivial - Cosmetic/trivial, optional fix

**Examples**:
```
0001-[open]-[highest]-critical-security-fix.md
0002-[investigating]-[high]-counter-not-updating.md
0003-[confirmed]-[medium]-css-scoping-issue.md
0004-[fixing]-[high]-event-handler-binding.md
0005-[testing]-[low]-minor-ui-glitch.md
0006-[fixed]-[medium]-slot-rendering-bug.md
0007-[rejected]-[lowest]-working-as-designed.md
```

### Status Values

**Active Statuses** (stay in root directory):
- `open` - Bug reported, pending analysis
- `investigating` - Under investigation
- `confirmed` - Confirmed as bug, pending fix
- `fixing` - Fix in progress
- `testing` - Fix implemented, in QA testing

**Archive Statuses** (moved to `archivados/`):
- `fixed` - Successfully resolved and verified
- `rejected` - Not a bug or wontfix
- `duplicate` - Duplicate of another bug
- `wontfix` - Decided not to fix

### Directory Structure

```
.lingma/bug-fixing/
├── README.md                    # This file
├── 0001-open-bug-description.md # Active bugs
├── 0002-fixing-another-bug.md   # Bugs in progress
└── archivados/                  # Closed/resolved bugs
    ├── 0001-fixed-css-scoping-2026-05-14.md
    ├── 0002-rejected-feature-request-2026-05-10.md
    └── ...
```

### Archive Policy

When a bug is resolved (status: `fixed`, `rejected`, `duplicate`, or `wontfix`):

1. Update the bug file with resolution details
2. Move to `archivados/` folder with date:
   ```bash
   mv 0001-fixed-bug.md archivados/0001-fixed-bug-YYYY-MM-DD.md
   ```
3. Keep active bugs in root directory for easy access

---

## Workflow Process

### Creating a New Bug Report

1. Copy the template:
   ```bash
   cp .lingma/bug-fixing/TEMPLATE.md .lingma/bug-fixing/0001-open-bug-title.md
   ```

2. Update the filename with next number and status
3. Fill in the metadata and description sections
4. Start investigation

Para cada bug reportado, seguiremos este proceso:

### 1. Recepción del Bug
- Recibir el reporte del equipo de QA
- Documentar en un archivo individual en esta carpeta

### 2. Análisis
- [ ] **Investigar el código existente**: Revisar la implementación actual
- [ ] **Evaluar el reporte de QA**: Analizar si es realmente un bug o comportamiento esperado
- [ ] **Confirmar o rechazar**: Documentar la decisión

### 3. Reporte de Bug (si aplica)
Si se confirma que es un bug, crear un reporte con:
- **Título**: Descripción clara y concisa
- **Prioridad**: Alta / Media / Baja
- **Componente afectado**: Qué parte del código está involucrada
- **Pasos para reproducir**: Cómo se puede replicar el bug
- **Comportamiento esperado**: Qué debería suceder
- **Comportamiento actual**: Qué está sucediendo
- **Archivos involucrados**: Lista de archivos a modificar

### 4. Fix
- [ ] Implementar la solución
- [ ] Ejecutar tests existentes para verificar que no se rompió nada
- [ ] Agregar tests específicos para el bug fix si es necesario
- [ ] Verificar en el ejemplo que funciona correctamente

### 5. Documentation & Archive

**⚠️ CRITICAL: Update External Documentation First**

Before closing the bug, update consumer-facing documentation:

1. **README.md** - If API/behavior changed
2. **FEATURES.md** - If new feature or error code added
3. **docs/index.html** - If user-facing change

Then update internal docs:
4. **Steering docs** - Document technical learnings
5. **Bug report** - Add resolution details

**Archive the Bug**:
```bash
# Move to archive with date
mv 0001-fixed-bug.md archivados/0001-fixed-bug-2026-05-14.md
```

---

## Useful Commands

### View Active Bugs
```bash
# List all active bugs
ls .lingma/bug-fixing/*.md

# Count by status
ls .lingma/bug-fixing/*-open-*.md | wc -l        # Open
ls .lingma/bug-fixing/*-fixing-*.md | wc -l       # In progress
ls .lingma/bug-fixing/*-testing-*.md | wc -l      # Testing
```

### View Archived Bugs
```bash
# List archived bugs
ls .lingma/bug-fixing/archivados/*.md

# Count total archived
ls .lingma/bug-fixing/archivados/*.md | wc -l
```

### Search Bugs
```bash
# Search in active bugs
grep -l "counter" .lingma/bug-fixing/*.md

# Search in all bugs (active + archived)
grep -r "counter" .lingma/bug-fixing/ --include="*.md"

# Find bugs by status
ls .lingma/bug-fixing/*-confirmed-*.md
```

### Archive a Bug
```bash
# Move fixed bug to archive with date
mv .lingma/bug-fixing/0001-fixed-issue.md \
   .lingma/bug-fixing/archivados/0001-fixed-issue-2026-05-14.md
```

### Development Commands
```bash
# Run tests
yarn test

# Run specific tests
yarn test lib/parser

# Build example
cd example && yarn build

# Dev server
cd example && yarn dev
```
