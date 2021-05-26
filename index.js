const app = require("express")()
const cors = require("cors")
const http = require("http").createServer(app)

app.use(cors())

/* socket.io WS server */
const io = require("socket.io")(http, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
})

/* Check win algorithm */
const array_chunks = (array, chunk_size) =>
  Array(Math.ceil(array.length / chunk_size))
    .fill()
    .map((_, index) => index * chunk_size)
    .map((begin) => array.slice(begin, begin + chunk_size))

function checkDiagonalsWin(char, arr, GRID_SIZE) {
  arr = array_chunks(arr, GRID_SIZE)
  let n = arr.length
  let diag1 = []
  let diag2 = []
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        diag1.push(arr[i][j])
      }
      if (i + j === n - 1) {
        diag2.push(arr[i][j])
      }
    }
  }

  if (diag1.filter((item) => item.flag === char).length === GRID_SIZE)
    return true

  if (diag2.filter((item) => item.flag === char).length === GRID_SIZE)
    return true

  return false
}

const checkRowWin = (char, arr, GRID_SIZE) => {
  for (let i = 0; i < GRID_SIZE; i++) {
    const temp = arr.filter((item) => item.row === i)
    if (temp.filter((item) => item.flag === char).length === GRID_SIZE) {
      return true
    }
  }
  return false
}

const checkColumnWin = (char, arr, GRID_SIZE) => {
  for (let i = 0; i < GRID_SIZE; i++) {
    const temp = arr.filter((item) => item.column === i)
    if (temp.filter((item) => item.flag === char).length === GRID_SIZE) {
      return true
    }
  }
  return false
}

const checkWin = (char, arr) => {
  const GRID_SIZE = Math.sqrt(arr.length)

  if (checkRowWin(char, arr, GRID_SIZE)) return true
  if (checkColumnWin(char, arr, GRID_SIZE)) return true
  if (checkDiagonalsWin(char, arr, GRID_SIZE)) return true

  return false
}

/* Game rooms e.g [{ name: GAME_ID, users: [USER_ID_1, USER_ID_2] }...] */
let rooms = []

app.get('/random', function(req, res) {
  res.json(rooms);
});

/* WS connect event */
io.on("connect", (socket) => {
  /* WS "join" event with arguments of USER_ID and GAME_ROOM */
  socket.on("join", ({ id, room }) => {
    /* Search if GAME_ROOM already exists ? else Create a new one */
    if (rooms.findIndex((el) => el.name === room) === -1)
      rooms.push({ name: room, users: [id] })

    /* get GAME_ROOM index in 'rooms' array */
    const roomIndex = rooms.findIndex((el) => el.name === room)

    /* add USER to room if USERS < 2 in room and it's not the same USER */
    if (
      rooms[roomIndex].users.length < 2 &&
      !rooms[roomIndex].users.includes(id)
    ) {
      /* join the room in WS */
      socket.join(room)
      /* push USER to 'rooms' array */
      rooms[roomIndex].users.push(id)
    }

    /* if GAME_ROOM have 2 active users */
    if (rooms[roomIndex].users.length === 2) {
      /* WS message room with status */
      io.to(room).emit("message", "Игра в процессе")

      /* shuffle USERS in room's users-array */
      rooms[roomIndex].users.sort(() => Math.random() - 0.5)

      /* WS emit random USER to make first turn */
      io.to(rooms[roomIndex].users[0]).emit("turn", 1)
      io.to(rooms[roomIndex].users[1]).emit("turn", 0)

      /* WS emit room to be ready as players-connected */
      io.to(room).emit("playersConnected", true)
    }

    console.log(id, room, rooms) // log id, room, rooms on player 'connect'
  })

  socket.on("restartGame", ({ room, grid }) => {
    grid.forEach(item => item.flag = null)
    io.to(room).emit("refreshGrid", { grid })
  })

  /* WS on 'step' event */
  socket.on("step", ({ id, room, grid, step }) => {

    /* on each step emit current grid to room */
    io.to(room).emit("step", { grid })

    /* on each step increment step number */
    io.to(room).emit("nextStep", step + 1)

    if (checkWin("x", grid)) 
    io.to(room).emit("finishGame", { id, status: "x" })

    if (checkWin("o", grid)) 
      io.to(room).emit("finishGame", { id, status: "o" })

    if (!checkWin("x", grid) && !checkWin("o", grid) && grid.length === step + 1) 
      io.to(room).emit("finishGame", { status: null })
  })

  /* WS on 'finishGame' event */
  socket.on("finishGame", ({ id, room, status }) => {
    /* emit to room as game finished */
    io.to(room).emit("finishGame", { id, status })
  })

  /* WS on 'disconnect' event */
  socket.on("disconnect", () => {
    /* get USERID */
    const id = socket.id

    let leftRoom

    /* search for user in all rooms */
    rooms.forEach((room) => {
      /* get USER index in room's users array */
      const index = room.users.findIndex((el) => el === id)

      /* if user is found */
      if (index !== -1) {

        leftRoom = room

        /* delete USER from array */
        room.users.splice(index, 1)
      }
    })

     /* emit message to GAME_ROOM as not enough players for game to continue */
    if (leftRoom !== undefined && leftRoom.users !== undefined && leftRoom.users.length === 1) {
      io.to(leftRoom.users[0]).emit("playersConnected", false)
    }

    rooms = rooms.filter(room => room.users.length > 0)

    console.log(rooms) // log rooms on player 'disconnect'
  })
})

/* start server on port 4000 */
http.listen(4000, function () {
  console.log("listening on port 4000")
})
