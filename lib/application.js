let http = require('http')
let EventEmitter = require('events')
let context = require('./context')
let request = require('./request')
let response = require('./response')
let Stream = require('stream')

class Application extends EventEmitter{
  constructor(){
    super()
    this.middlewares = []
    this.context = context
    this.request = request
    this.response = response
  }
  use(fn){
    this.middlewares.push(fn)
  }
  compose(){
    return async ctx =>{
      function createNext(middleware, oldNext){
        return async ()=>{
          await middleware(ctx, oldNext)
        }
      }
      let len = this.middlewares.length
      let next = async ()=>{
        return Promise.resolve()
      }
      for (let i=len-1; i>=0; i--) {
        let currentMiddleware = this.middlewares[i]
        next = createNext(currentMiddleware, next)
      }
      await next()
    }
  }
  createContext(req, res){
    const ctx = Object.create(this.context)
    const request = ctx.request = Object.create(this.request)
    const response = ctx.response = Object.create(this.response)
    ctx.req = request.req = response.req = req
    ctx.res = request.res = response.res = res
    request.ctx = response.ctx = ctx
    request.response = response
    response.request = request
    return ctx
  }
  handleRequest(ctx, fn){
    let res = ctx.res
    fn(ctx)
    .then(()=>{
      let bodyType = typeof ctx.body
      if (bodyType == 'object') {
        res.setHeader('Content-type', 'application/json;charset=utf8')
        res.end(JSON.stringify(ctx.body))
      } else if (ctx.body instanceof Stream) {
        ctx.body.pipe(res)
      } else if (bodyType == 'string' || Buffer.isBuffer(ctx.body)) {
        res.setHeader('Content-type', 'text/html;charset=utf8')
        res.end(ctx.body)
      } else {
        res.end('not found')
      }
    })
    .catch(err=>{
      this.emit('error', err)
      res.statusCode = 500
      res.end('server error')
    })
  }
  callback(){
    const fn = this.compose()
    return (req,res)=>{
      console.log('callback....')
      const ctx = this.createContext(req, res)
      return this.handleRequest(ctx, fn)
    }
  }
  listen(...args){
    let server = http.createServer(this.callback())
    return server.listen(...args)
  }
}

module.exports = Application