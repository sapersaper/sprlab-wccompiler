import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideZoneChangeDetection } from '@angular/core';
import { AppComponent } from './app/app.component';

// Import WCC compiled components
import './wcc-components/basics/wcc-card';
import './wcc-components/basics/wcc-counter';
import './wcc-components/basics/wcc-list';

bootstrapApplication(AppComponent, {
  providers: [provideZoneChangeDetection({ eventCoalescing: true })]
}).catch((err) => console.error(err));
