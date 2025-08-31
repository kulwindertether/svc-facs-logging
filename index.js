'use strict'

const async = require('async')
const Base = require('bfx-facs-base')
const pino = require('pino')

class LoggingFacility extends Base {
  constructor (caller, opts, ctx) {
    super(caller, opts, ctx)
    this._hasConf = true

    this.name = 'logging'
    this.logger = null

    if (!this.opts.name || typeof this.opts.name !== 'string') {
      throw new Error('ERR_INVALID_NAME')
    }

    this.init()
  }

  _start (cb) {
    async.series([
      next => { super._start(next) },
      async () => {
        this._initializeLogger()
      }
    ], cb)
  }

  _initializeLogger () {
    const name = this.opts.name
    const level = this.conf.debug === 0 ? 'info' : 'debug'
    const enabled = this.opts.enabled ?? true

    const baseConfig = {
      name,
      level,
      enabled
    }

    console.log('LoggingFacility: using config', this._hasTransportOptions())
    console.log('LoggingFacility: using config', this.conf)
    if (this._hasTransportOptions()) {
      this.logger = this._createLoggerWithTransport(baseConfig)
    } else {
      this.logger = this._createFallbackLogger(baseConfig)
    }
  }

  _hasTransportOptions () {
    return !!(
      this.conf?.transport?.topic &&
      this.conf?.transport?.secretKey
    )
  }

  _createLoggerWithTransport (baseConfig) {
    const transportConfig = {
      targets: [
        {
          target: './lib/pino-hyperswarm-exporter',
          options: {
            app: baseConfig.name,
            topic: this.conf.transport.topic,
            secretKey: this.conf.transport.secretKey,
            maxRetries: this.conf.transport.maxRetries || 3,
            retryDelay: this.conf.transport.retryDelay || 2000
          }
        },
        {
          target: 'pino/file',
          options: { destination: 1 },
          level: 'info'
        },
        {
          target: 'pino/file',
          options: { destination: 2 },
          level: 'error'
        },
        {
          target: 'pino/file',
          options: { destination: 2 },
          level: 'warn'
        },
        {
          target: 'pino/file',
          options: { destination: 2 },
          level: 'fatal'
        }
      ]
    }

    return pino({
      ...baseConfig,
      transport: transportConfig
    })
  }

  _createFallbackLogger (baseConfig) {
    const stdout = pino.destination(1)
    const stderr = pino.destination(2)

    return pino(
      baseConfig,
      pino.multistream([
        { level: 'info', stream: stdout },
        { level: 'error', stream: stderr },
        { level: 'warn', stream: stderr },
        { level: 'fatal', stream: stderr }
      ], { dedupe: true })
    )
  }

  _stop (cb) {
    async.series([
      next => { super._stop(next) },
      async () => {
        if (this.logger) {
          this.logger.flush()
          delete this.logger
        }
      }
    ], cb)
  }
}

module.exports = LoggingFacility
