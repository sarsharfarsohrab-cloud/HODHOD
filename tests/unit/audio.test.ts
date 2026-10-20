import { describe, expect, test } from 'bun:test'
import { AudioPlayer, type AudioProvider } from '../../src/audio/audio.ts'

const provider = (id: string, log: string[], fail = false, can = true): AudioProvider => ({
  id,
  canSpeak: () => can,
  speak: async ({ text }) => {
    log.push(`${id}:${text}`)
    if (fail) throw new Error('no credit')
  },
  stop: () => {},
})

describe('audio player', () => {
  test('the natural voice speaks when it can', async () => {
    const log: string[] = []
    const player = new AudioPlayer([provider('cloud', log), provider('device', log)])
    expect(await player.speak('der Tisch', 'de', 1)).toBe(true)
    expect(log).toEqual(['cloud:der Tisch'])
  })

  test('when the natural voice fails, the phone voice takes over', async () => {
    const log: string[] = []
    const player = new AudioPlayer([provider('cloud', log, true), provider('device', log)])
    expect(await player.speak('der Tisch', 'de', 1)).toBe(true)
    expect(log).toEqual(['cloud:der Tisch', 'device:der Tisch'])
  })

  test('a provider that cannot speak (offline, switched off) is skipped', async () => {
    const log: string[] = []
    const player = new AudioPlayer([provider('cloud', log, false, false), provider('device', log)])
    await player.speak('Hallo', 'de', 1)
    expect(log).toEqual(['device:Hallo'])
  })
})
