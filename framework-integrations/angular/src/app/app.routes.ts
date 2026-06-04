import { Routes } from '@angular/router';
import { BasicsComponent } from './basics.component';
import { DirectivesComponent } from './directives.component';
import { CompositionComponent } from './composition.component';

export const routes: Routes = [
  { path: '', redirectTo: '/basics', pathMatch: 'full' },
  { path: 'basics', component: BasicsComponent },
  { path: 'directives', component: DirectivesComponent },
  { path: 'composition', component: CompositionComponent },
];
