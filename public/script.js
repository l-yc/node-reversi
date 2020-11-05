const log = {
  prefix: '[REVERSI]',
  debug: (...args) => console.log(log.prefix, ...args),
  error: (...args) => console.error(log.prefix, ...args),
};

/* networking */
let socket = io({
  autoConnect: true // no need to call socket.open()
});

socket.on('connect', event => {
  log.debug('Connected');
});

socket.on('disconnect', () => {
  log.debug('Disconnected');
});

socket.on('roomInfo', roomInfo => {
  log.debug(roomInfo);

  let id = document.querySelector('#room-id');
  id.innerHTML = roomInfo.id;

  let members = document.querySelector('#room-members');
  while (members.firstChild) members.removeChild(members.firstChild);
  roomInfo.members.forEach(m => {
    let li = document.createElement('li');
    li.innerHTML = m;
    members.appendChild(li);
  });

  PLAYER = roomInfo.members.indexOf(socket.id);
})

socket.on('gameMove', gameMove => {
  log.debug('received', gameMove);
  let pos = gameMove.pos;
  placeChecker(boardCell[pos[0]][pos[1]], gameMove.player);
})

socket.on('gameFlip', gameFlip => {
  log.debug('received', gameFlip);
  let pos = gameFlip.pos;
  flipChecker(pos[0], pos[1], gameFlip.player);
})

/* game */
let board = document.querySelector('#board');
let boardCell = [];
let boardData = [];

const BOARD_SIZE = 8;
let PLAYER = 0; // decided on server side

function roll(i, j) { return i*BOARD_SIZE + j; }

function unroll(i) { 
  i = parseInt(i);
  return [Math.floor(i/BOARD_SIZE), i%BOARD_SIZE];
}

function init() {
  while (board.firstChild) board.removeChild(board.firstChild);
  boardCell = [];
  boardData = [];

  for (let i = 0; i < BOARD_SIZE; ++i) {
    let row = document.createElement('div');
    row.classList.add('row');

    let rowCell = [];
    let rowData = [];
    for (let j = 0; j < BOARD_SIZE; ++j) {
      let cell = document.createElement('div');
      cell.dataset.pos = roll(i,j);
      cell.dataset.checker = '';
      cell.classList.add('cell');
      cell.addEventListener('click', e => {
        if (e.target == cell) clickCell(e.target);
      });
      row.appendChild(cell);

      rowCell.push(cell);
      rowData.push(-1);
    }
    board.appendChild(row);
    boardCell.push(rowCell);
    boardData.push(rowData);
  }
}

function clickCell(cell) {
  if (cell.dataset.checker === '') {
    placeChecker(cell, PLAYER);
  } else {
    alert('cannot place here!');
  }
}

function placeChecker(cell, player) {
  cell.dataset.checker = '1';

  let pos = unroll(cell.dataset.pos);
  boardData[pos[0]][pos[1]] = player;

  let checker = document.createElement('div');
  checker.classList.add('checker');
  if (player) checker.classList.add('is-flipped');
  checker.innerHTML = `
    <div class="face face--front"></div>
    <div class="face face--back"></div>
  `;
  cell.appendChild(checker);

  let p = unroll(cell.dataset.pos);
  log.debug('move', p);

  calculatePos(pos[0], pos[1], player);
  //cell.removeChild(checker);
  if (player === PLAYER) socket.emit('gameMove', { pos: p, player: PLAYER });
}

function calculatePos(x, y, player) {
  let dx = [-1,-1,-1,0,1,1,1,0];
  let dy = [-1,0,1,1,1,0,-1,-1];
  let flipped = false;
  log.debug(boardData);
  for (let i = 0; i < 8; ++i) {
    let nx = x, ny = y;
    for (let j = 0;; ++j) {
      nx += dx[i], ny += dy[i];
      if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) break;
      if (boardData[nx][ny] == -1) break;
      if (boardData[nx][ny] == player) {
        let xx = x, yy = y;
        for (let k = 0; k < j; ++k) {
          xx += dx[i], yy += dy[i];
          log.debug(xx, nx);
          flipChecker(xx, yy, player);
        }
        break;
      }
    }
  }
  return flipped;
}

function flipChecker(x, y, player) {
  boardData[x][y] = 1 - boardData[x][y];
  boardCell[x][y].querySelector('.checker').classList.toggle('is-flipped');
  if (player === PLAYER) socket.emit('gameFlip', { pos: [x,y] });
  log.debug('flipped', x, y);
}

/* forms */
let createRoomForm = document.querySelector('#create-room')
let joinRoomForm = document.querySelector('#join-room')

createRoomForm.querySelector('input[type=submit]').addEventListener('click', event => {
  event.preventDefault();
  const data = new FormData(joinRoomForm);
  socket.emit('roomCreate');
});

joinRoomForm.querySelector('input[type=submit]').addEventListener('click', event => {
  event.preventDefault();
  const data = new FormData(joinRoomForm);
  socket.emit('roomJoin', data.get('room-id'));
});

/** start **/
init();
