import React, { useState, useRef, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import Video from './Components/Video';

//import { WebRTCUser } from './types';
// <kau> WebRTC configuration 
// <kau> added disabledVideo field to WebRTCUser interface to hand over to Video component
export interface WebRTCUser {
  socketId: string;
  studentId: string;
  stream: MediaStream;
  isDisabledVideo: boolean; 
}

const pc_config = {
	iceServers: [
		// {
		//   urls: 'stun:[STUN_IP]:[PORT]',
		//   'credentials': '[YOR CREDENTIALS]',
		//   'username': '[USERNAME]'
		// },
		{
			urls: 'stun:stun.l.google.com:19302',
		},
	],
};
 //<kau> This means connecting to a secure WebSocket server from the client, which is necessary for production environments.
//<kau> const SOCKET_SERVER_URL = 'https://localhost:8000';
 const SOCKET_SERVER_URL = '192.168.0.6:8000'; // Change to your server URL to https from http

const App = () => {
	const socketRef = useRef<SocketIOClient.Socket>();
	//<kau> pcsRef is used to store the peer connections for each user : 나와 각 peer 간의 연결(RTCPeerConnection)을 저장하는 객체 
	//<kau> Mapping socket ID to RTCPeerConnection
	// <kau> .current is a actual object that holds the current value of the ref
	const pcsRef = useRef<{ [socketId: string]: RTCPeerConnection }>({});
	// <kau> Output video element reference to display : my video tag ref
	const localVideoRef = useRef<HTMLVideoElement>(null);
	// <kau> Actual data of camera or microphone stream : my camera or microphone stream
	const localStreamRef = useRef<MediaStream>();

	// <kau> Reference to store the users' streams and studentIds
	const [users, setUsers] = useState<WebRTCUser[]>([]);
	// type Student = {
    //             socketId: string,
	// 			studentId: string,
    //             stream?: MediaStream,
    //             muted: boolean,
    //             isDisabledVideo: boolean
    //         };
	// <added by kau> Reference to store data channels for each peer connection
	const dataChannelsRef = useRef<{ [socketId: string]: RTCDataChannel }>({});
	// myStudentIdRef is used to store the student ID of the current user
	const myStudentIdRef = useRef<string | null>(sessionStorage.getItem("studentId"));
	const myIsDisabledVideoRef = useRef<boolean | null>(sessionStorage.getItem("isDisabledVideo") === "false");
	// 삭제
	//const [studentReady, setStudentReady] = useState(false);

	
	const getLocalStream = useCallback(async () => {
		try {
			const localStream = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: {
					// <kau> width and height are set to 240x240
					width: 240,
					height: 240,
				},
			});
			localStreamRef.current = localStream;
			let socketID: string | undefined = undefined;
			if (socketRef.current) {
				socketID = socketRef.current.id;
			}
			
			if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
			if (!socketRef.current) return;
			// <kau_added>
			//const studentId = sessionStorage.getItem("studentId");
			if (myStudentIdRef.current) {
				console.log("Retrieved studentId from sessionStorage:", myStudentIdRef.current , myIsDisabledVideoRef.current);
				//socketRef.current.emit("rejoin_student", { studentId });
				socketRef.current.emit("join_room", {
					room: "1234", // <kau> Change if needed
					socketID: socketID,
					studentId: myStudentIdRef.current,
					isDisabledVideo: myIsDisabledVideoRef.current, // <kau> added to track if video is disabled
				});
			} else {
				console.log("No studentId found in sessionStorage.");
				socketRef.current.emit('join_room', {
				room: '1234',
				socketID: socketID,
				studentId: null, // <kau> null ID if not found
				isDisabledVideo: false, // <kau> Set default video enabled state
			});
			// <kau_added> Save the studentId to the ref
			//myStudentIdRef.current = studentId; // Save the studentId to the ref
			}

			// <kau_added> Save when studentId is assigned by the server
			socketRef.current.on("initial_setting", ({ studentId, isDisabledVideo }: { studentId: string, isDisabledVideo: boolean}) => {
			myStudentIdRef.current = studentId;
			myIsDisabledVideoRef.current = isDisabledVideo; // <kau> Set default video enabled state
			sessionStorage.setItem("studentId", studentId);
			sessionStorage.setItem("isDisabledVideo", String(isDisabledVideo));
			console.log("Assigned initial_setting:", studentId, isDisabledVideo);
			//console.log("Received config:", config);
			//setStudentReady(true); // after this, create offer ~
			if (socketRef.current) {
				socketRef.current.emit("ready_to_receive_users", {
					room: '1234',
					socketID: socketRef.current.id,
					studentId: myStudentIdRef.current,
					isDisabledVideo: myIsDisabledVideoRef.current,
				});
			}else {
				console.error("Socket not connected when receiving initial_setting");
			}
			console.log("Student is ready to receive users.");
			});
			
		

			

			

		} catch (e) {
			console.log(`getUserMedia error: ${e}`);
		}
	}, []);

	const createPeerConnection = useCallback((socketID: string, studentId: string, isOfferer: boolean,isDisabledVideo: boolean) => {
		try {
			//<kau> an object generated by each peer connection individually
			const pc = new RTCPeerConnection(pc_config);
			// <kau> Let my ICE candidate be sent to the other user
			// <kau> ICE Candidate : How to connect with this 나랑 어떻게 연결할 수 있는 지 (i.e. IP, Port, Protocol)
			pc.onicecandidate = (e) => {
				if (!(socketRef.current && e.candidate)) return;
				console.log('(3-1)onicecandidate');
				socketRef.current.emit('candidate', {
					candidate: e.candidate,
					candidateSendID: socketRef.current.id,
					candidateReceiveID: socketID,
				});
			};

			pc.oniceconnectionstatechange = (e) => {
				console.log(e);
			};
			// <kau> Main video stream receiving part
			pc.ontrack = (e) => {
				console.log('ontrack success');

				
				setUsers((oldUsers) =>
					oldUsers
						.filter((user) => user.socketId !== socketID)
						.concat({
							socketId: socketID,
							studentId: studentId,
							stream: e.streams[0], // <kau> e.streams[0] is the stream from the other user either video or audio or both
							isDisabledVideo: isDisabledVideo, // <kau> added to track if video is disabled
						}),
				);
				console.log(`ontrack: ${socketID} / studentID: ${studentId} added with Video Off`, isDisabledVideo);
				// Attach event listeners to the track itself
				const track = e.track;
				if (track) {
					track.onmute = () => {
						// console.log(`Track from sender is muted`);
						// When the track is muted, we can set the video to be disabled
						// <kau> Hide the video from the other user's web
						setUsers((prev) =>
							prev.map((user) =>
								user.socketId === socketID ? { ...user, isDisabledVideo: true } : user
							)
							
						);
						
					};
					track.onunmute = () => {
						// console.log(`Track from sender is unmuted`);
						// When the track is unmuted, we can set the video to be enabled
						
						// <kau> Show the video from the other user's web
						setUsers((prev) =>
							prev.map((user) =>
								user.socketId === socketID ? { ...user, isDisabledVideo: false } : user
							)
						);
					};
					track.onended = () => {
						console.log(`Track ended`);
						
					};
				}
			};
			// <kau> Main video stream sending part
			if (localStreamRef.current) {
				console.log('localstream add');
				localStreamRef.current.getTracks().forEach((track) => {
					if (!localStreamRef.current) return;
					// <kau> Add the local stream track to the peer connection
					pc.addTrack(track, localStreamRef.current);
				});
			} else {
				console.log('no local stream');
			}
			
			// <kau> If it is the offerer, create a data channel to send control messages
			if (isOfferer) {
				const dc = pc.createDataChannel("control");
				dc.onmessage = handleDataChannelMessage;
				dc.onopen = () => console.log(`Offerer: DataChannel open with ${socketID}`);
				dataChannelsRef.current[socketID] = dc;
			} else {
				pc.ondatachannel = (event) => {
				const channel = event.channel;
				console.log(`Answerer: DataChannel open with ${socketID} via ondatachannel`);
				channel.onmessage = handleDataChannelMessage;
				dataChannelsRef.current[socketID] = channel;
				};
			}
			// // 매 5초마다 전송량 확인 (전송 중인 모든 트랙에 대해)
			// const logStatsInterval = setInterval(async () => {
			// if (!pc) return;

			// const senders = pc.getSenders();
			// for (const sender of senders) {
			// 	if (!sender.track) continue;

			// 	const stats = await sender.getStats();
			// 	stats.forEach(report => {
			// 	if (report.type === 'outbound-rtp') {
			// 		console.log('Time Stamp:', report.timestamp);
			// 		console.log(`→ packetsSent: ${report.packetsSent}`);
			// 		console.log(`→ bytesSent: ${report.bytesSent}`);
			// 		console.log(`→ headerBytesSent: ${report.headerBytesSent}`);
			// 	}
			// 	});
			// }
			// }, 5000); // 5초 간격

			// // 이후 pc가 닫히면 clearInterval 필요
			// pc.onconnectionstatechange = () => {
			// if (pc.connectionState === "closed" || pc.connectionState === "failed" || pc.connectionState === "disconnected") {
			// 	clearInterval(logStatsInterval);
			// }
			// };


			return pc;
		} catch (e) {
			console.error(e);
			return undefined;
		}
	}, []);
	


	// <kau> Test
	// State: record whether the video sending to each peer is disabled
	// Mapping socket ID to boolean
	// [current value, the function to toggle the value]
	// disabledPeers is an object that id is key and boolean is value
	// inital value: {} -> no peer (no peer is disabled at the beginning)

	

// <kau> When the users array changes, we need to update the disabledPeers state
// useEffect(() => {

//   const updatedPeers: { [socketId: string]: boolean } = {};
//   users.forEach((user) => {
//     updatedPeers[user.socketId] = disabledPeers[user.socketId] ?? false;
//   });
//   setDisabledPeers(updatedPeers);
//   console.log(`Updated disabledPeers state:`, updatedPeers);
// }, [users]);

// <kau> Define the function to toggle video sending to a specific peer
const toggleVideoSend = (targetSocketId: string) => {
  const pc = pcsRef.current[targetSocketId];
  if (!pc) return; // If RTCPeerConnection is not found in pcsRef
  console.log(`Toggling video send for peer: ${targetSocketId}`);
  
  
 // getSenders: 현재 pc에서 출력하는 모든 미디어를 다 가져오는 Method , 
 // sender: An object representing a media stream track (음성이나 비디오 트랙 하나)
 // track: a media stream track (음성이나 비디오 트랙)

	const channel = dataChannelsRef.current[targetSocketId];

	if (channel && channel.readyState === "open") {
		const message = {
		type: "TOGGLE_VIDEO",
		from: socketRef.current?.id, // SENDER ID 
		};

		channel.send(JSON.stringify(message)); // Serialize the message to JSON
		console.log(`Sent TOGGLE_VIDEO to ${targetSocketId} from ${socketRef.current?.id}`);
		// channel.close(); // Close the channel if I need
	} else {
		console.warn(`DataChannel not open for ${targetSocketId}`);
	}


  // Save the toggled state for the target peer
  // Why we get the previous state
  // Because it is asynchronous, we need to get the previous state and create a new state -> React special feature
  // To prevent Race Condition
//   setDisabledPeers((prev) => ({
//     ...prev,
//     [targetSocketId]: !isDisabled,
//   }));
};

{/* <kau> State to hold the input value for the target socket ID
<kau> when a user clicks the button, it will toggle the video sending to the peer with that socket ID via toggleVideoSend function
<kau> useState enables us to create a state variable and a function to update that variable */}
const [targetIdInput, setTargetIdInput] = useState('');


const [videoSize, setVideoSize] = useState<{ width: number; height: number }>({
  width: 240,
  height: 240,
});

const toggleVideoSize = () => {
  setVideoSize((prev) =>
    prev.width === 240 ? { width: 100, height: 100 } : { width: 240, height: 240 }
  );
};

// const handleDataChannelMessage = (event: MessageEvent) => {
//   const msg = JSON.parse(event.data);
//   if (msg.type === "TOGGLE_VIDEO") {
// 	console.log(`I got msg from ${msg.from}: ${disabledPeers}`);
// 	// Get my all Senders to msg.from (It does not mean getting msg.from's Senders)
// 	// track.enabled controls common track objects
// 	// MediaStreamTrack.enabled = false controls specific track's actual video data
//     const videoSender = pcsRef.current[msg.from]?.getSenders().find(
//       (s) => s.track?.kind === "video" || s.track === null
//     );
// 	if (videoSender && videoSender.track?.kind === "video") {
// 	  //videoSender.track.enabled = !videoSender.track.enabled;
// 	  videoSender.replaceTrack(null);
// 	  console.log(`Video track disabled`);
// 	  //setDisabledPeers({ ...disabledPeers });
// 	}
// 	else{
// 		const videoTrack = localStreamRef.current?.getVideoTracks()[0];
// 		if (videoTrack && videoSender) {
// 			videoSender.replaceTrack(videoTrack);
// 			console.log(`Video track enabled`);
// 		}
// 	}
// }
// };

// 삭제
// const [trackOn, setTrackOn] = useState(true);
// const trackOnRef = useRef(trackOn);
const handleDataChannelMessage = (event: MessageEvent) => {
  const msg = JSON.parse(event.data);

  if (msg.type === "TOGGLE_VIDEO") {
    console.log(`Received TOGGLE_VIDEO from ${msg.from}`);
	//console.log(`TrackOn state before toggle: ${trackOnRef.current}`);
    myIsDisabledVideoRef.current = !myIsDisabledVideoRef.current; 
	//console.log(`TrackOn state after toggle: ${trackOnRef.current}`);
    const videoTrack = localStreamRef.current
      ?.getVideoTracks()[0] ?? null;

	//console.log("videoTrack:", videoTrack);
	//console.log("videoTrack.readyState:", videoTrack?.readyState);
  
    // Replace replaceTrack(null) all PeerConnection connected with this videoTrack
    Object.entries(pcsRef.current).forEach(([peerId, pc]) => {
      const sender = pc.getSenders().find(
        (s) => s.track?.kind === "video"|| s.track === null
      );
	  //console.log(`Peer: ${peerId}, Found video sender:`, sender);
	  if (sender) {
		if (myIsDisabledVideoRef.current) {
		  // <kau> If newTrackOn is true, replace with the local video track
		  sender.replaceTrack(videoTrack);
		  //console.log(`Replaced video track for peer ${peerId}`);
		} else {
		  // <kau> If newTrackOn is false, replace with null to disable video
		  sender.replaceTrack(null);
		  //console.log(`Disabled video track for peer ${peerId}`);
		}
	  } else {
		console.warn(`No video sender found for peer ${peerId}`);
	  }
	});

	//console.log(`1. new trackOn state: ${newTrackOn}`);
    // 삭제 UI 업데이트용 상태도 함께 갱신
    //setTrackOn(trackOnRef.current);
	//console.log(`2. new trackOn state: ${newTrackOn}`);
  }
};



// <kau> test


	useEffect(() => {
		socketRef.current = io.connect(SOCKET_SERVER_URL);
		getLocalStream();

		



		// <kau> Add peers into list from server
		socketRef.current.on('all_users', (allUsers: Array<{ id: string; studentId: string , isDisabledVideo: boolean}>) => {
			// 삭제
			// if (!studentReady) {
			// 	console.log('Student not ready, waiting for student ID assignment');
			// 	return;
			// }
			allUsers.forEach(async (user) => {
				console.log('all_users received:', user);
				if (!localStreamRef.current) return;
				// <kau> Create an offer part
				const pc = createPeerConnection(user.id, user.studentId,true,user.isDisabledVideo);
				if (!(pc && socketRef.current)) return;
				pcsRef.current = { ...pcsRef.current, [user.id]: pc };
				try {
					// <kau> Set the local stream to the peer connection
					// <kau> This is the stream from my camera or microphone if I want, I can control here
					const localSdp = await pc.createOffer({
						offerToReceiveAudio: true,
						offerToReceiveVideo: true,
					});
					console.log('(1)create offer success', myStudentIdRef.current,' to ', user.id,'video Off:', myIsDisabledVideoRef.current);
					const socketID = socketRef.current.id;
					await pc.setLocalDescription(new RTCSessionDescription(localSdp));
					socketRef.current.emit('offer', {
						sdp: localSdp,
						offerSendID: socketID,
						// <kau>
						offererStudentId: myStudentIdRef.current,
						offerReceiveID: user.id,
						offererIsDisabledVideo: myIsDisabledVideoRef.current, // <kau> added to track if video is disabled
					});
					
				} catch (e) {
					console.error(e);
				}
			});
		});

		socketRef.current.on(
			'getOffer',
			async (data: {
				sdp: RTCSessionDescription;
				offererID: string;
				offererStudentId: string;
				offererIsDisabledVideo: boolean;
			}) => {



				const { sdp, offererID, offererStudentId, offererIsDisabledVideo } = data;
				console.log(`(1-2)get offer : getOffer received from ${offererID} with studentId ${offererStudentId} and isDisabledVideo ${offererIsDisabledVideo}`);
				
				if (!localStreamRef.current) return;
				// <kau> getOffer part
				const pc = createPeerConnection(offererID, offererStudentId,false,offererIsDisabledVideo);
				if (!(pc && socketRef.current)) return;
				pcsRef.current = { ...pcsRef.current, [offererID]: pc };
				try {
					// <kau> Set the received SDP (offer) to my peer connection
					// <kau> Prepare for SDP (answer) to send to the user who sent the offer
					await pc.setRemoteDescription(new RTCSessionDescription(sdp));
					console.log('(1-3)answer set remote description success');
					const localSdp = await pc.createAnswer({
						offerToReceiveVideo: true,
						offerToReceiveAudio: true,
					});
					// <kau> Set the local(my) SDP (answer) to my peer connection
					await pc.setLocalDescription(new RTCSessionDescription(localSdp));
					socketRef.current.emit('answer', {
						sdp: localSdp,
						answerSendID: socketRef.current.id,
						answerReceiveID: offererID,
					});
					console.log('(2-1)create answer success');
				} catch (e) {
					console.error(e);
				}
			},
		);

		socketRef.current.on(
			'getAnswer',
			(data: { sdp: RTCSessionDescription; answerSendID: string }) => {
				const { sdp, answerSendID } = data;
				console.log('(2-2)get answer');
				const pc: RTCPeerConnection = pcsRef.current[answerSendID];
				if (!pc) return;
				pc.setRemoteDescription(new RTCSessionDescription(sdp));
			},
		);

		socketRef.current.on(
			'getCandidate',
			async (data: { candidate: RTCIceCandidateInit; candidateSendID: string }) => {
				console.log('(4-1)get candidate');
				const pc: RTCPeerConnection = pcsRef.current[data.candidateSendID];
				if (!pc) return;
				await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
				console.log('(4-2)candidate add success');
			},
		);

		socketRef.current.on('user_exit', (data: { id: string }) => {
			if (!pcsRef.current[data.id]) return;
			pcsRef.current[data.id].close();
			delete pcsRef.current[data.id];
			setUsers((oldUsers) => oldUsers.filter((user) => user.socketId !== data.id));
		});

		return () => {
			if (socketRef.current) {
				socketRef.current.disconnect();
			}
			users.forEach((user) => {
				if (!pcsRef.current[user.socketId]) return;
				pcsRef.current[user.socketId].close();
				delete pcsRef.current[user.socketId];
			});
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [createPeerConnection, getLocalStream]);

	return (
		<div>
			{/* <kau> My video element to display my camera or microphone stream */}
			<video
  				style={{
    			width: videoSize.width,
    			height: videoSize.height,
    			margin: 5,
				backgroundColor: 'black',
			}}
			muted
			ref={localVideoRef}
			autoPlay
			playsInline
			controls
			/>
			<button onClick={toggleVideoSize}>Toggle Video Size</button>

			{/* 
			<kau> Original code
			{users.map((user, index) => (
				<Video key={index} email={user.email} stream={user.stream} />
			))} */}

			{/* <kau> Modified code to include button for toggling video send */}
			{/* Connect to index.tsx via users.map handing over props*/}
			{/* {console.log("Rendering users:")} */}
			{/*studentReady && */users.map((user, index) => (
  				<div key={index}>
										
    		<Video studentId={user.studentId}
				   stream={user.stream} 
				   isDisabledVideo={user.isDisabledVideo} 
				   />
				   {console.log(`${user.studentId} (${user.socketId}) → Video Off: ${user.isDisabledVideo}`)}
    		<button onClick={() => {toggleVideoSend(user.socketId); /* <kau> Toggle video only clicked peer */
				/* toggleVideoSize(); */} }>
      		{user.isDisabledVideo ? ' Resume Video to Peer' : ' Stop Video to Peer'}
			
    		</button>

			
  	</div>
))}


			{/* <kau> Input field to enter socket ID to block video sending */}
			<div style={{ marginTop: 20, marginBottom: 10 }}>
				<input
					type="text"
					placeholder="Enter socket ID to block"
					value={targetIdInput}
					onChange={(e) => setTargetIdInput(e.target.value)}
					style={{ marginRight: 10, width: 300 }}
				/>
				<button
					onClick={() => toggleVideoSend(targetIdInput)}
					style={{
						padding: '8px 16px',
						fontSize: '16px',
						cursor: 'pointer',
					}}
				>
					Toggle Video to Socket ID
				</button>
			</div>
		</div>
	);
};

export default App;




