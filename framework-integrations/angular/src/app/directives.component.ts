import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { WccSlotsDirective, WccSlotDef } from '../wcc-components/angular-adapter';

@Component({
  selector: 'app-directives',
  standalone: true,
  imports: [WccSlotsDirective, WccSlotDef],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './directives.component.html',
})
export class DirectivesComponent {
  condVisible = true;
  showVisible = true;
  inputValue = '';
  styledVariant = 'primary';
  styledColor = '#333';

  onValueChanged(event: Event) {
    this.inputValue = (event as CustomEvent).detail.value;
  }
}
