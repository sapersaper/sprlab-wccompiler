import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-composition',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './composition.component.html',
})
export class CompositionComponent {
  wrapperCount = 5;
  parentChanged: number | null = null;
  eachItems = [1, 2, 3];

  onParentChanged(event: Event) {
    this.parentChanged = (event as CustomEvent).detail;
  }
}
