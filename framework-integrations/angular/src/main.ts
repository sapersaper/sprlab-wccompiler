import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';

// Import WCC compiled components
import './wcc-components/basics/wcc-card';
import './wcc-components/basics/wcc-counter';
import './wcc-components/basics/wcc-list';
import './wcc-components/basics/wcc-dualmodel';
import './wcc-components/directives/wcc-conditional';
import './wcc-components/directives/wcc-toggle';
import './wcc-components/directives/wcc-input';
import './wcc-components/directives/wcc-styled';
import './wcc-components/composition/wcc-wrapper';
import './wcc-components/composition/wcc-parent';

bootstrapApplication(AppComponent, {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withHashLocation()),
  ]
}).catch((err) => console.error(err));
