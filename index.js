const path = require('path');
const express = require('express');
const app = express();

const port = 8888;

const log = {
  debug: require('debug')('deal:index:debug'),
  error: require('debug')('deal:index:error')
};

app.use(express.static(path.join(__dirname, '/public')));
//app.set('views', path.join(__dirname, 'views'));
//app.set('view engine', 'pug');
//
//app.use('/slides', require('./controllers/slide-viewer.js')(express));
//app.use('/browse', require('./controllers/slide-selector.js')(express));

//app
//  .listen(port, () => {
//    log.debug('Server listening on port %d', port);
//  })
//  .on('error', function (err) {
//    if(err.errno === 'EADDRINUSE') {
//      log.error('Port %d is busy, terminating.', port);
//    } else {
//      log('Error encountered when launching server: %o', err);
//    }
//  });

const http = require('http');
const server = http.createServer(app);

server.listen(port);
server.on('listening', () => {
  log.debug('Server listening on port %d', port);
})
server.on('error', err => {
  if(err.errno === 'EADDRINUSE') {
    log.error('Port %d is busy, terminating.', port);
  } else {
    log('Error encountered when launching server: %o', err);
  }
})

const io = require('socket.io')(server);
const crypto = require("crypto");

class Room {
  constructor(id) {
    this.id = id;
    this.members = [];
  }

  isEmpty() {
    return this.members.length === 0;
  }
};

let rooms = {}; // room id, room object
let socketToRoom = {};

function createRoom() {
  const id = crypto.randomBytes(16).toString("hex");
  rooms[id] = new Room(id);
  log.debug('created room', id);
  return rooms[id];
}

function deleteRoom(room) {
  delete rooms[room.id];
}

function leaveRoom(socket, room) {
  if (room === undefined) {
    log.debug('room does not exist!');
    return;
  }

  socket.leave(room.id);
  let idx = room.members.indexOf(socket.id);
  room.members.splice(idx, 1);
  if (room.isEmpty()) deleteRoom(room);
  log.debug(socket.id, 'left room', room.id);
}

function joinRoom(socket, room) {
  // check if room exists first
  if (room === undefined) {
    log.debug('room does not exist!');
    return;
  }

  // leave old room
  const orig = rooms[socketToRoom[socket.id]];
  leaveRoom(socket, orig);

  // join new room
  socketToRoom[socket.id] = room.id;
  socket.join(room.id);
  room.members.push(socket.id);
  log.debug(socket.id, 'joined room', room.id);

  // update room info
  io.to(room.id).emit('roomInfo', room);
}

io.on('connection', socket => {
  log.debug(socket.id, 'connected');

  socket.on('disconnect', () => {
    const id = socketToRoom[socket.id];
    leaveRoom(socket, rooms[id]);
  });

  socket.on('roomCreate', () => joinRoom(socket, createRoom()));
  socket.on('roomJoin', id => joinRoom(socket, rooms[id]));
  socket.on('gameMove', move => {
    log.debug('received move', move);
    const roomId = socketToRoom[socket.id];
    socket.broadcast.to(roomId).emit('gameMove', move);
    log.debug('broadcasting to', roomId);
  });
});

