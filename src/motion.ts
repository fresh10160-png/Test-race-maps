import { Motion } from '@capacitor/motion'
import type { PluginListenerHandle } from '@capacitor/core'

const GRAVITY_MPS2 = 9.80665

export async function watchGForce(onSample: (g: number) => void): Promise<PluginListenerHandle> {
  return Motion.addListener('accel', (event) => {
    const g = event.accelerationIncludingGravity
    if (!g) return
    const magnitude = Math.sqrt((g.x || 0) ** 2 + (g.y || 0) ** 2 + (g.z || 0) ** 2) / GRAVITY_MPS2
    // A stationary device still reads ~1G from gravity alone. A reading
    // near zero means there's no real accelerometer (null/undefined
    // fields coerce to 0 in arithmetic) rather than genuine free-fall.
    if (!Number.isFinite(magnitude) || magnitude < 0.3) return
    onSample(Math.abs(magnitude - 1))
  })
}
