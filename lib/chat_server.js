let socketio = require('socket.io')
let io;
let guestNumber = 1
let nickNames = {}
let nameUsed = []
let currentRoom = {}

function assignGustName(socket, guestNumber, nickName, nameUsed) {
    let name = 'Guest ' + guestNumber
    nickNames[socket.id] = name
    socket.emit('nameResult', {
        success: true,
        name: name
    })
    nameUsed.push(name)
    return guestNumber + 1
}

function joinRoom(socket, room) {
    socket.join(room)
    currentRoom[socket.id] = room
    socket.emit('joinResult', { room: room })
    socket.broadcast.to(room).emit('message', {
        text: nickNames[socket.id] + ' has joined ' + room + '.'
    })

    io.of('/').in(room).clients(function(error,clients){
        let usersInRoom = clients
        if (usersInRoom.length > 1) {
            let usersInRoomSummary = 'Users currently in ' + room + ': '
            for (let index in usersInRoom) {
                let userSocketId = usersInRoom[index]
                if (userSocketId != socket.id) {
                    if (index > 0) {
                        usersInRoomSummary += ', '
                    }
                    usersInRoomSummary += nickNames[userSocketId]
                }
            }
            usersInRoomSummary += '.'
            socket.emit('message', { text: usersInRoomSummary })
        }
    });
}

function handleNameChangeAttempts(socket, nickNames, nameUsed) {
    socket.on('nameAttempt', (name) => {
        if (name.indexOf('Guest') == 0) {
            socket.emit('nameResult', {
                success: false,
                message: 'Name cannot begin with "Guest".'
            })
        } else {
            if (nameUsed.indexOf(name) == -1) {
                let previousName = nickNames[socket.id]
                let previousNameIndex = nameUsed.indexOf(previousName)
                nameUsed.push(name)
                nickNames[socket.id] = name
                delete nameUsed[previousNameIndex]

                socket.emit('nameResult', {
                    success: true,
                    name: name
                })
                socket.broadcast.to(currentRoom[socket.id].emit('message', {
                    text: previousName + ' is now known as ' + name + '.'
                }))
            } else {
                socket.emit('nameResult', {
                    success: false,
                    message: 'That name is already in use.'
                })
            }
        }
    })
}

function handleMessageBroadcasting(socket) {
    socket.on('message', (message) => {
        socket.broadcast.to(message.room).emit('message', {
            text: nickNames[socket.id] + ': ' + message.text
        })
    })
}

function handleRoomJoining(socket) {
    socket.on('join', (room) => {
        socket.leave(currentRoom[socket.id])
        joinRoom(socket, room.newRoom)
    })
}

function handleClientDisconnection(socket) {
    socket.on('disconnect', ()=>{
        let nameIndex = nameUsed.indexOf(nickNames[socket.id])
        delete nameUsed[nameIndex]
        delete nickNames[socket.id]
    })
}

exports.listen = function (server) {
    io = socketio.listen(server)
    io.set('log level', 1)
    io.sockets.on('connection', (socket) => {
        guestNumber = assignGustName(socket, guestNumber, nickNames, nameUsed)
        joinRoom(socket, 'Lobby')
        handleMessageBroadcasting(socket, nickNames)
        handleNameChangeAttempts(socket, nickNames, nameUsed)
        handleRoomJoining(socket)

        socket.on('rooms', () => {
            socket.emit('rooms', io.sockets.rooms)
        })

        handleClientDisconnection(socket, nickNames, nameUsed)
    })
}