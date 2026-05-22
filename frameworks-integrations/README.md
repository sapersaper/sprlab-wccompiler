# Framework Integrations

This directory contains default scaffold projects for the three major frontend frameworks. These projects are used for testing WCC compiler integrations with different frameworks.

## Projects

### 1. Vue Project (`vue-project/`)
- **Framework**: Vue 3
- **Build Tool**: Vite
- **Setup**: Created with `npm create vue@latest --default`
- **Status**: Default scaffold, no modifications

**Commands:**
```bash
cd vue-project
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

### 2. React Project (`react-project/`)
- **Framework**: React 18
- **Build Tool**: Vite
- **Setup**: Created with `npm create vite@latest --template react`
- **Status**: Default scaffold, no modifications

**Commands:**
```bash
cd react-project
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

### 3. Angular Project (`angular-project/`)
- **Framework**: Angular (latest)
- **Build Tool**: Angular CLI
- **Setup**: Created with `ng new --skip-git --skip-install --defaults`
- **Status**: Default scaffold, no modifications

**Commands:**
```bash
cd angular-project
ng serve         # Start development server
ng build         # Build for production
ng test          # Run unit tests
```

## Purpose

These projects serve as:
- Reference implementations for framework integrations
- Testing grounds for WCC compiler compatibility
- Examples of default framework configurations
- Base projects for integration testing

## Notes

- All projects are kept at their default configuration
- No custom modifications have been made
- Dependencies are installed and ready to run
- Each project can be started independently

## Adding WCC Integration

To integrate WCC compiler with any of these projects:
1. Install `@sprlab/wccompiler` as a dependency
2. Configure the build tool to process `.wcc` files
3. Import and use WCC components in your framework components

See the main project README for detailed integration instructions.
