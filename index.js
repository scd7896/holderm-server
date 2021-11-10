const express = require("express");
const cors = require("cors")

const app = express();

const server = app.listen(10001, () => {
	console.log("서버 열림 10001")
})

const io = require("socket.io")(server, {
	cors: {
		origin: "*"
	}
});
app.use(cors())
app.set("socket", io);

const users = {};
const socketToRoom = {};
const maximum = 5;
const room = {};

io.on("connection", socket => {
	socket.on("join_room", data => {
		const payload = data.payload || {};
		payload.socketId = socket.id;
		payload.join = true;
		if (room[data.room]) {
			const index = room[data.room].users.findIndex((user) => user.id === payload.id)
			const isRejoin = index !== -1;
			if (isRejoin) {
				room[data.room].users[index] = payload;
			} else {
				const length = room[data.room].users.length;
				if (length >= maximum) {
					socket.to(socket.id).emit("room_full");
					return;
				}
				
				room[data.room].users.push(payload)
				console.log("joiinnn", room[data.room])
			}
		} else {
			room[data.room] = {
				status: 1,
				users: [payload]
			}
		}
		socketToRoom[socket.id] = data.room;
		socket.join(data.room);

		const usersInThisRoom = room[data.room].users.filter(
				user => user?.socketId !== socket.id
		);

		usersInThisRoom.map(user => {
			if (user) {
				io.sockets.to(user.socketId).emit("newUser", {
					socketId: socket.id,
					payload
				})
			}
		})

		io.sockets.to(socket.id).emit("getAllUser", {
				users: room[data.room].users, 
				you: payload
			}
		);
		console.log("room", room[data.room])
	})

	socket.on("offer", ({ sdp, toSocketId, payload }) => {
		
		io.sockets.to(toSocketId).emit("getOffer", { sdp, fromSocketId: socket.id, payload });
	});

	socket.on("answer", ({ sdp, toSocketId, payload }) => { 
		io.sockets.to(toSocketId).emit("getAnswer", { sdp, fromSocketId: socket.id, payload });
	});

	
	socket.on("candidate", ({ candidate, toSocketId, payload }) => {
			io.sockets.to(toSocketId).emit("getCandidate", { payload, candidate, fromSocketId: socket.id, toSocketId })
			
	});

	// user가 연결이 끊겼을 때 처리
	socket.on("disconnect", () => {
		const roomID = socketToRoom[socket.id];
		
		let targetRoom = room[roomID];

		if (targetRoom) {

				const index = targetRoom.users.findIndex(user => user?.socketId === socket.id);
				if (index >= 0) {
					targetRoom.users[index].join = false
				}

				const isAllUserLeft = !targetRoom.users.reduce((acc, user) => acc || user.join, false);

				console.log(isAllUserLeft)
				if (isAllUserLeft) {
					targetRoom = null;
				} else {
					console.log("룸의 유저들", targetRoom)
					targetRoom.users.map(user => {
						if (user.join) io.sockets.to(user.socketId).emit("user_disconnect", targetRoom.users[index])
					})
				}
		}
		console.log("afterDisconnect",targetRoom)	
	});

})