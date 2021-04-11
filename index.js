const app = require('express')()
const http = require('http').createServer(app)

/* socket.io WS server */
const io = require('socket.io')(http, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"]
    }
})

/* Game rooms e.g [{ name: GAME_ID, users: [USER_ID_1, USER_ID_2] }...] */
const rooms = []

/* WS connect event */
io.on('connect', socket => {

  /* WS "join" event with arguments of USER_ID and GAME_ROOM */
  socket.on('join', ({ id, room }) => {

    /* Search if GAME_ROOM already exists ? else Create a new one */
    if (rooms.findIndex(el => el.name === room) === -1)
      rooms.push({ name: room, users: [id] })

    /* get GAME_ROOM index in 'rooms' array */
    const roomIndex = rooms.findIndex(el => el.name === room)

    /* add USER to room if USERS < 2 in room and it's not the same USER */
    if (rooms[roomIndex].users.length < 2 && !rooms[roomIndex].users.includes(id)) {
      /* join the room in WS */
      socket.join(room) 
      /* push USER to 'rooms' array */
      rooms[roomIndex].users.push(id) 
    }

    /* if GAME_ROOM have 2 active users */
    if (rooms[roomIndex].users.length === 2) {
      /* WS message room with status */
      io.to(room).emit('message', 'Игра в процессе')
      
      /* shuffle USERS in room's users-array */
      rooms[roomIndex].users.sort(() => Math.random() - 0.5)
      
      /* WS emit random USER to make first turn */
      io.to(rooms[roomIndex].users[0]).emit('turn', 1)
      
      /* WS emit room to be ready as players-connected */
      io.to(room).emit('playersConnected', true)
    }

    console.log(id, room, rooms) // log id, room, rooms on player 'connect' 
  })

  /* WS on 'step' event */
  socket.on('step', ({ room, grid, step }) => {
    /* on each step emit current grid to room */
    io.to(room).emit('step', { grid })
    /* on each step increment step number */
    io.to(room).emit('nextStep', step + 1)
  })

  /* WS on 'finishGame' event */
  socket.on('finishGame', ({ id, room, status }) => {
    /* emit to room as game finished */
    io.to(room).emit("finishGame", { id, status })
  })
    
  /* WS on 'disconnect' event */
  socket.on('disconnect', () => {

    /* get USERID */
    const id = socket.id

    /* search for user in all rooms */
    rooms.forEach(room => {
      /* get USER index in room's users array */
      const index = room.users.findIndex(el => el === id)
      
      /* if user is found */
      if (index !== -1) {
        /* delete USER from array */
        room.users.splice(index, 1)
        /* emit message to GAME_ROOM as not enough players for game to continue */
        socket.to(room).emit('playersConnected', false)
      }
    })

    console.log(rooms) // log rooms on player 'disconnect' 
  })
})

/* start server on port 4000 */
http.listen(4000, function() {
  console.log('listening on port 4000')
})