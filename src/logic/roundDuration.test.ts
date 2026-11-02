import { describe, expect, it } from 'vitest'

import { roundDuration } from './roundDuration'

describe('roundDuration', () => {
  it('rounds to 5-minute steps with minimum of 10 minutes', () => {
    expect(roundDuration(4)).toBe(10)
    expect(roundDuration(7)).toBe(10)
    expect(roundDuration(12.67)).toBe(15)
    expect(roundDuration(22)).toBe(20)
    expect(roundDuration(23)).toBe(25)
  })
})

describe('roundDuration dedicated cases', () => {
  it('rounds 4 to 10', () => {
    expect(roundDuration(4)).toBe(10)
  })

  it('rounds 7 to 10', () => {
    expect(roundDuration(7)).toBe(10)
  })

  it('rounds 12.67 to 15', () => {
    expect(roundDuration(12.67)).toBe(15)
  })

  it('rounds 22 to 20', () => {
    expect(roundDuration(22)).toBe(20)
  })

  it('rounds 23 to 25', () => {
    expect(roundDuration(23)).toBe(25)
  })
})
