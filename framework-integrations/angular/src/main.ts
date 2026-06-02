import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideZoneChangeDetection } from '@angular/core';
import { AppComponent } from './app/app.component';

// Import WCC compiled components
import './wcc-components/wcc-card';
import './wcc-components/wcc-counter';
import './wcc-components/wcc-list';

bootstrapApplication(AppComponent, {
  providers: [provideZoneChangeDetection({ eventCoalescing: true })]
}).catch((err) => console.error(err));
