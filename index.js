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
const maximum = 7;

io.on("connection", socket => {
	socket.on("join_room", data => {
		console.log("room", users[data.room])
		if (users[data.room]) {
			const length = users[data.room].length;
			let index = 0;
			for (let i = 0; i < maximum; i++) {
				if (!users[data.room][i]) {
					index = i;
					break;
				}
			}

			if (length >= maximum) {
				socket.to(socket.id).emit("room_full");
				return;
			}
			users[data.room][index] = { id: socket.id, number: index, nickname: data.nickname, money: data.money };
		} else {
			users[data.room] = [{ id: socket.id, number: 0, nickname: data.nickname, money: data.money }]
		}
		socketToRoom[socket.id] = data.room;
		socket.join(data.room);

		const usersInThisRoom = users[data.room].filter(
				user => user?.id !== socket.id
		);

		const targetUserIndex = users[data.room].findIndex(
			user => user?.id === socket.id
		);

		usersInThisRoom.map(user => {
			io.sockets.to(user.id).emit("new_user", {
				id: socket.id, 
				number: users[data.room][targetUserIndex].number, 
				nickname: data.nickname, 
				money: data.money
			})
		})

		io.sockets.to(socket.id).emit("all_users", {
				users: usersInThisRoom, 
				you: { 
					id: socket.id, 
					number: users[data.room][targetUserIndex].number, 
					nickname: data.nickname, 
					money: data.money
				}
			}
		);
	})

	socket.on("offer", ({ sdp, toSocketId, number, user }) => {
		
		io.sockets.to(toSocketId).emit("getOffer", { sdp, fromSocketId: socket.id, number, user });
	});

	socket.on("answer", ({ sdp, toSocketId, number, user }) => { 
		io.sockets.to(toSocketId).emit("getAnswer", { sdp, fromSocketId: socket.id, number, user });
	});

	
	socket.on("candidate", ({ candidate, toSocketId, number }) => {
			io.sockets.to(toSocketId).emit("getCandidate", { number, candidate, fromSocketId: socket.id, toSocketId })
			
	});

	// user가 연결이 끊겼을 때 처리
	socket.on("disconnect", () => {
	
			const roomID = socketToRoom[socket.id];
	
			let room = users[roomID];
	
			if (room) {
	
					const index = room.findIndex(user => user?.id === socket.id);
					if (index >= 0) {
						room[index] = null
					}
					users[roomID] = room;
			}
			
			socket.broadcast.to(room).emit("user_exit", { id: socket.id });
	});

})