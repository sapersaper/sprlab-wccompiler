import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@Component({
  selector: 'app-directives',
  standalone: true,
  imports: [],
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
    this.inputValue = (event as CustomEvent).detail;
  }
}
