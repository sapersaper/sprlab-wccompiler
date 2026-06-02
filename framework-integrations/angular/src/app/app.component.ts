import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { WccSlotsDirective, WccSlotDef } from '../wcc-components/angular-adapter';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [WccSlotsDirective, WccSlotDef],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './app.component.html',
})
export class AppComponent {
  propCount = 10;
  eventCount = 0;
  modelCount = 0;
  multiCount = 0;
  multiLabel = 'hello';
  angularMessage = 'hello from Angular!';

  onCountChanged(event: Event) {
    this.eventCount = (event as CustomEvent).detail;
  }
}
