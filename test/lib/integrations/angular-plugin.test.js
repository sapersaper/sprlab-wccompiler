import { describe, test, expect } from 'vitest'
import { transformBananaBox } from '../../../integrations/angular-plugin.js'

describe('transformBananaBox', () => {
  // 2.2 Test: transforms simple banana-box on custom element
  test('transforms simple banana-box on custom element', () => {
    const input = '<my-counter [(count)]="val"></my-counter>'
    const expected = '<my-counter [count]="val" (countChange)="val = $any($event).detail"></my-counter>'
    expect(transformBananaBox(input)).toBe(expected)
  })

  // 2.3 Test: does NOT transform banana-box on native elements
  test('does NOT transform banana-box on native elements', () => {
    const input = '<div [(prop)]="val"></div>'
    expect(transformBananaBox(input)).toBe(input)
  })

  // 2.4 Test: does NOT transform [(ngModel)] on any element
  test('does NOT transform [(ngModel)] on any element', () => {
    const inputCustom = '<my-comp [(ngModel)]="val"></my-comp>'
    const inputNative = '<input [(ngModel)]="val">'
    expect(transformBananaBox(inputCustom)).toBe(inputCustom)
    expect(transformBananaBox(inputNative)).toBe(inputNative)
  })

  // 2.5 Test: handles multiple banana-box on the same custom element
  test('handles multiple banana-box on the same custom element', () => {
    const input = '<my-comp [(count)]="num" [(name)]="label"></my-comp>'
    const expected = '<my-comp [count]="num" (countChange)="num = $any($event).detail" [name]="label" (nameChange)="label = $any($event).detail"></my-comp>'
    expect(transformBananaBox(input)).toBe(expected)
  })

  // 2.6 Test: preserves existing attributes without modification
  test('preserves existing attributes without modification', () => {
    const input = '<my-comp class="active" id="comp1" [(count)]="val" data-test="true"></my-comp>'
    const result = transformBananaBox(input)
    expect(result).toContain('class="active"')
    expect(result).toContain('id="comp1"')
    expect(result).toContain('data-test="true"')
    expect(result).toContain('[count]="val"')
    expect(result).toContain('(countChange)="val = $any($event).detail"')
  })

  // 2.7 Test: returns content unchanged if no banana-box on custom elements
  test('returns content unchanged if no banana-box on custom elements', () => {
    const input = '<my-comp [count]="val" (countChange)="onCount($event)"></my-comp>'
    expect(transformBananaBox(input)).toBe(input)
  })

  // 2.8 Test: handles complex expressions in binding
  test('handles complex expressions in binding', () => {
    const inputObj = '<my-comp [(value)]="obj.prop"></my-comp>'
    const expectedObj = '<my-comp [value]="obj.prop" (valueChange)="obj.prop = $any($event).detail"></my-comp>'
    expect(transformBananaBox(inputObj)).toBe(expectedObj)

    const inputArr = '<my-comp [(value)]="arr[0]"></my-comp>'
    const expectedArr = '<my-comp [value]="arr[0]" (valueChange)="arr[0] = $any($event).detail"></my-comp>'
    expect(transformBananaBox(inputArr)).toBe(expectedArr)
  })

  // 2.9 Test: transformation is idempotent (applying twice = same result)
  test('transformation is idempotent', () => {
    const input = '<my-comp [(count)]="val"></my-comp>'
    const firstPass = transformBananaBox(input)
    const secondPass = transformBananaBox(firstPass)
    expect(secondPass).toBe(firstPass)
  })
})
