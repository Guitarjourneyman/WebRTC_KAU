const fs = require('fs'); // <kau> added to resolve https issues
let express = require('express');
let http = require('https'); // <kau> changed to https to resolve https issues
let app = express();
let cors = require('cors');

let server = http.createServer({
 key: fs.readFileSync(process.env.SSL_KEY_FILE || 'C:\\Windows\\System32\\key.pem'), // <kau> added to resolve https issues
 cert: fs.readFileSync(process.env.SSL_CRT_FILE || 'C:\\Windows\\System32\\cert.pem')
},app);
let socketio = require('socket.io');
let io = socketio.listen(server);

app.use(cors());
const PORT = process.env.PORT || 8000; // <kau> Change to 8000 if you want to use the same port as the web app

// <kau> Define empty object --maybe should be removed-- or extended to store not only students
let users = {};
// <kau_added> temp test string student ids
let studentCounter = 1;
let studentMap = {};  
// <kau_added> temp test







let socketToRoom = {};
// <kau> Maximum number of users allowed in a room
const maximum = process.env.MAXIMUM || 8;

// <kau> Connect socket to the server
// <kau> 'connection' is an event that is triggered when a user connects to the server, not just randomly named string
io.on('connection', socket => {
    
        // <kau> test

    socket.on('join_room', data => {
        // <kau_added> start
        // First entrance to the room
        
        if (!data.studentId){
            assignedId = `student_${studentCounter++}`;
            assignedDisabledVideo = data.isDisabledVideo || false; // <kau> added to track if video is disabled
            studentMap[assignedId] = {
                socketId: socket.id,
                stream: null,
                room: data.room,
                isDisabledVideo: false
            };
        console.log(`new Student ID: ${assignedId} joined room: ${data.room} with socketID: ${socket.id}, disabled video: ${studentMap[assignedId].isDisabledVideo}`);
        }
        // Rejoin the room
        else
            {
            assignedId = data.studentId;
            studentMap[assignedId].socketId = socket.id;
            assignedDisabledVideo = data.isDisabledVideo || false // <kau> added to track if video is disabled
            console.log(`Student ${assignedId} rejoined room: ${data.room} with socketID: ${socket.id} , disabled video: ${assignedDisabledVideo}`);
        }
        // <kau_added> end

        // Original code starts here (email -> studentId)
        if (users[data.room]) {
            const length = users[data.room].length;
            if (length === maximum) {
                socket.to(socket.id).emit('room_full');
                return;
            }
            // <kau> Add the user id and studentId to the users object
            users[data.room].push({id: socket.id, studentId: assignedId, isDisabledVideo: assignedDisabledVideo});
            console.log("1.users updated:", users);
        } else {
            users[data.room] = [{id: socket.id, studentId: assignedId, isDisabledVideo: assignedDisabledVideo}];
            console.log("new room created:");
        }
        // Original code ends here

        // <kau_added> Send initial assigned student ID and its config to the client
        socket.emit("initial_setting", {
        studentId: assignedId,
        isDisabledVideo: assignedDisabledVideo, // <kau> added to track if video is disabled
        //config: studentMap[assignedId]
        });
        


        // Original code starts here 
        // <kau> To know this socket is in which room
        socketToRoom[socket.id] = data.room;
        // <kau> Join the room
        socket.join(data.room);
        console.log(`[${socketToRoom[socket.id]}]: ${assignedId}/${socket.id} enter `);

        //<kau> Show all users in the room to the new user
        // const usersInThisRoom = users[data.room].filter(user => user.id !== socket.id);
        // console.log(usersInThisRoom);
        // // <kau> Edit all_users to send students objects instead of just ids
        // const studentsInThisRoom = usersInThisRoom.map(user => {
        //     const student = studentMap[user.studentId] || {};
        //     return {
        //         id: user.id,
        //         studentId: user.studentId,
        //         stream: student.stream || null, // <kau> Add stream if exists
        //         isDisabledVideo: student.isDisabledVideo || false // <kau> Add video status if exists
        //     };});
        // // Alrert the other users in the room that a new user has joined
        // // so that it can make a connection
        // // <kau> Edit all_users to send students objects instead of just ids
        // io.sockets.to(socket.id).emit('all_users', studentsInThisRoom);
        // console.log('all_users:', studentsInThisRoom);
        
        socket.on("ready_to_receive_users", (data) => {
            const usersInRoom = users[data.room]?.filter(user => user.id !== socket.id) || [];

            const studentsInThisRoom = usersInRoom.map(user => {
                const student = studentMap[user.studentId] || {};
                return {
                    id: user.id,
                    studentId: user.studentId,
                    stream: student.stream || null,
                    isDisabledVideo: student.isDisabledVideo || false
                };
            });

            io.sockets.to(socket.id).emit('all_users', studentsInThisRoom);
            console.log(`[${data.room}] ready_to_receive_users → all_users resent:`, studentsInThisRoom);
});

    });
    /*<kau>   Peer information exchange part   */

    //<kau> Send offer to the user with its RTCSessionDescription
    socket.on('offer', data => {
        //console.log(data.sdp);
        // console.log(`offer from ${data.offerSendID} studentID ${data.offererStudentId} to ${data.offerReceiveID}`);
        socket.to(data.offerReceiveID).emit('getOffer', {sdp: data.sdp, offererID: data.offerSendID, offererStudentId: data.offererStudentId, offererIsDisabledVideo: data.offererIsDisabledVideo});
    });
    //<kau> Send an answer to the user sent an offer
    socket.on('answer', data => {
        //console.log(data.sdp);
        //console.log(`answer from ${data.answerSendID} to ${data.answerReceiveID}`);
        socket.to(data.answerReceiveID).emit('getAnswer', {sdp: data.sdp, answerSendID: data.answerSendID});
    });
    //<kau> After a user received signal info by offer and answer, it sends the its candidate info to the another peer
    socket.on('candidate', data => {
        //console.log(data.candidate);
        socket.to(data.candidateReceiveID).emit('getCandidate', {candidate: data.candidate, candidateSendID: data.candidateSendID});
    })


    /*<kau>   Peer information exchange part   */


    //<kau> When disconnected, remove them from the users object.
    socket.on('disconnect', () => {
        console.log(`[${socketToRoom[socket.id]}]: ${socket.id} exit`);
        const roomID = socketToRoom[socket.id];
        let room = users[roomID];
        if (room) {
            room = room.filter(user => user.id !== socket.id);
            users[roomID] = room;
            if (room.length === 0) {
                delete users[roomID];
                return;
            }
        }
        // <kau> Alert the other users in the room that a user has left.
        // <kau> socket.broadcast.to(room).emit('user_exit', {id: socket.id}); -> broadcast to all users unless specifying a room
        socket.to(roomID).emit('user_exit', {id: socket.id}); // <kau> the other users except itself
        console.log(users);
    })
});

server.listen(PORT, () => {
    console.log(`server running on ${PORT}`);
});