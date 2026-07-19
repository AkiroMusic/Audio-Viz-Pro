export class BeatDetector {
  private energyHistory: number[] = []
  private historyLength = 43  // ~1 second of history at 43fps
  private threshold = 1.4     // current / avg energy > threshold = beat
  
  public isBeat = false
  public bpm = 0
  private lastBeatTime = 0
  private bpmHistory: number[] = []

  // Call every frame with current energy (0~1)
  update(energy: number, timestamp: number): void {
    this.energyHistory.push(energy)
    if (this.energyHistory.length > this.historyLength) {
      this.energyHistory.shift()
    }

    const avgEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length
    const prevBeat = this.isBeat
    this.isBeat = energy > avgEnergy * this.threshold && energy > 0.1

    // Detect rising edge (new beat)
    if (this.isBeat && !prevBeat) {
      const interval = timestamp - this.lastBeatTime
      if (interval > 200 && interval < 2000) { // 30~300 BPM
        this.bpmHistory.push(60000 / interval)
        if (this.bpmHistory.length > 8) this.bpmHistory.shift()
        this.bpm = Math.round(this.bpmHistory.reduce((a, b) => a + b, 0) / this.bpmHistory.length)
      }
      this.lastBeatTime = timestamp
    }
  }
}
