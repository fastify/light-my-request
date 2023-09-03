class Benchmark {
  opsPerSec = 0
  mean = 0
  deviation = 0

  constructor (name, fn) {
    this.name = name
    this.fn = fn
    this.maxSample = 100
  }

  async runAsync (limitTime) {
    let time = 0
    let times = 0
    const samples = []
    while (time < limitTime * 1e6) {
      const timeStart = process.hrtime()
      await this.fn()
      const timeEnd = process.hrtime(timeStart)
      time += timeEnd[0] * 1e9 + timeEnd[1]
      samples.push(timeEnd[0] * 1e9 + timeEnd[1])
      times++
    }
    this.time = time
    this.times = times
    return samples
  }

  runSync (limitTime) {
    let time = 0
    let times = 0
    const samples = []
    while (time < limitTime * 1e6) {
      const timeStart = process.hrtime()
      this.fn()
      const timeEnd = process.hrtime(timeStart)
      time += timeEnd[0] * 1e9 + timeEnd[1]
      samples.push(timeEnd[0] * 1e9 + timeEnd[1])
      times++
    }
    this.time = time
    this.times = times
    return samples
  }

  batch (samples) {
    if (samples.length > this.maxSample) {
      const newSamples = []
      const batchLength = Math.floor(samples.length / this.maxSample)
      for (let i = 0; i < samples.length; i += batchLength) {
        const batch = samples.slice(i, i + batchLength)
        if (batchLength !== batch.length) continue
        newSamples.push(batch.reduce((a, b) => a + b, 0))
      }
      return { samples: newSamples, batchLength }
    }
    return { samples, batchLength: 1 }
  }

  async run (limitTime) {
    const isPromise = this.fn() instanceof Promise

    const { samples: bSamples, batchLength } = this.batch(isPromise ? await this.runAsync(limitTime) : this.runSync(limitTime))

    const sum = bSamples.reduce((a, b) => a + b, 0)
    this.mean = bSamples.reduce((a, b) => a + b, 0) / bSamples.length
    this.deviation = Math.sqrt(bSamples.reduce((a, b) => a + (b - this.mean) ** 2, 0) / bSamples.length)
    this.opsPerSec = (bSamples.length * batchLength / (sum / 1e9)).toFixed()
  }

  toString () {
    return `${this.name} x ${this.opsPerSec} ops/sec ±${(this.deviation / this.mean * 100).toFixed(2)}% (${this.times} runs sampled)`
  }
}

class Suite {
  /** @type {Benchmark[]} */
  benchmarks = []
  callbacks = {}

  constructor (opt) {
    this.opt = Object.assign({
      msPerBenchmark: 1000
    }, opt || {})
  }

  add (name, fn) {
    this.benchmarks.push(new Benchmark(name, fn))
    return this
  }

  async run () {
    for await (const benchmark of this.benchmarks) {
      try {
        await benchmark.run(this.opt.msPerBenchmark)
      } catch (err) {
        console.error(benchmark.name, err)
      }
      this.callbacks.cycle?.forEach((listener) => listener({
        name: benchmark.name,
        target: benchmark
      }))
    }
  }

  on (event, cb) {
    if (!this.callbacks[event]) this.callbacks[event] = []
    this.callbacks[event].push(cb)
    return this
  }

  onCycle (cb) {
    if (!this.callbacks.cycle) this.callbacks.cycle = []
    this.callbacks.cycle.push(cb)
  }
}

module.exports = Suite
