import { Server } from 'socket.io';
import http from 'http';

let io: Server;

export const initSocket = (server: http.Server) => {
  io = new Server(server, {
    cors: {
      origin: true,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    socket.on('joinRoom', (roomNumber) => {
      socket.join(roomNumber);
    });

    socket.on('leaveRoom', (roomNumber) => {
      socket.leave(roomNumber);
    });
  });
};

export const emitVoteUpdate = (roomNumber: string) => {
  if (io) {
    io.to(roomNumber).emit('voteUpdate', { message: 'New vote cast' });
  }
};

export const emitResultsPublished = (roomNumber: string) => {
  if (io) {
    io.to(roomNumber).emit('resultsPublished', { message: 'Results are now available' });
  }
};
