import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { WccSlotsDirective, WccSlotDef } from '@sprlab/wccompiler/adapters/angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [WccSlotsDirective, WccSlotDef],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './app.component.html',
})
export class AppComponent {
  count = 0;

  onCountChanged(event: Event) {
    this.count = (event as CustomEvent).detail;
  }
}
