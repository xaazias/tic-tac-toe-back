const app = require('express')()
const http = require('http').createServer(app)
const io = require('socket.io')(http, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"]
    }
})

io.on('connection', socket => {
  socket.on('message', ({ grid }) => {
    io.emit('message', { grid })
  })
})

http.listen(4000, function() {
  console.log('listening on port 4000')
})