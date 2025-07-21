// import React, { useEffect, useRef, useState } from 'react';
// import styled from 'styled-components';

// interface VideoContainerProps {
//   $isDisabledVideo?: boolean;
// }

// const Container = styled.div`
//   position: relative;
//   display: inline-block;
//   width: 200px;
//   height: 200px;
//   margin: 5px;
// `;

// const VideoContainer = styled.video.attrs(() => ({
//   playsInline: true,
//   autoPlay: true,
//   webkitPlaysInline: 'true',
// }))<VideoContainerProps>`
//   width: '200px';
//   height: '200px';
//   background-color: 'pink';
//   transform: translateZ(0);
// `;

// const UserLabel = styled.p`
//   display: inline-block;
//   position: absolute;
//   top: 180px;
//   left: 0px;
// `;

// interface Props {
//   email: string;
//   stream: MediaStream;
//   muted?: boolean;
//   isDisabledVideo?: boolean; // <kau> added 
// }

// const Video = ({ email, stream, muted ,isDisabledVideo}: Props) => {
//   const ref = useRef<HTMLVideoElement>(null);
//   const [isMuted, setIsMuted] = useState<boolean>(false);
//   const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(true);

//   useEffect(() => {
//     if (muted) setIsMuted(true);
//   }, [muted]);

//   useEffect(() => {
//     const video = ref.current;
//     if (!video || !stream) return;

//     video.srcObject = stream;
//     (video as any).playsInline = true;
//     video.muted = isMuted;

//     const playVideo = () => {
//       video.play().catch((err) => {
//         console.warn('Autoplay error:', err);
//       });
//     };

//     video.onloadedmetadata = playVideo;

//     const touchPlay = () => {
//       video.play().catch(() => {});
//     };
//     document.addEventListener('touchstart', touchPlay, { once: true });

//     const videoTrack = stream.getVideoTracks()[0];
//     if (videoTrack) {
//       setIsVideoEnabled(videoTrack.enabled); // 초기 상태 반영

//       videoTrack.onmute = () => {
//         console.log(`[${email}] Video muted`);
//         setIsVideoEnabled(false);
//       };

//       videoTrack.onunmute = () => {
//         console.log(`[${email}] Video unmuted`);
//         setIsVideoEnabled(true);
//       };
//     }

//     return () => {
//       document.removeEventListener('touchstart', touchPlay);
//     };
//   }, [stream]);

//   return (
//     <Container>
//       {isVideoEnabled ? (
//         <VideoContainer ref={ref} muted={isMuted} $isDisabledVideo={false} />
//       ) : (
//         <div
//           style={{
//             width: '200px',
//             height: '200px',
//             margin: 5,
//             backgroundColor: 'lightgray',
//             display: 'flex',
//             alignItems: 'center',
//             justifyContent: 'center',
//           }}
//         >
//           Video Off
//         </div>
//       )}
//       <UserLabel>{email}</UserLabel>
//     </Container>
//   );
// };

// export default Video;


import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

// <kau> added to handle disabled video styling
interface VideoContainerProps {
	$isDisabledVideo?: boolean; 
}

// <kau> Other users' video component
// edited size flexibliy (originally 240 * 270)
const Container = styled.div<VideoContainerProps>`
	position: relative;
	display: inline-block;
	width: ${(props) => (props.$isDisabledVideo ? '100px' : '200px')};
	height: ${(props) => (props.$isDisabledVideo ? '100px' : '200px')};
	margin: 5px;
	maragin-bottom: 10px; // <kau> added to avoid overlap with other components
`;
// <kau> Video container with dynamic size based on isDisabledVideo prop - ~testing
// isDisabledVideo  true: none , false: show
const VideoContainer = styled.video.attrs(() => ({
  playsInline: true,
  autoPlay: true,
  webkitPlaysInline: 'true',
}))<VideoContainerProps>`
  width: ${(props) => (props.$isDisabledVideo ? '100px' : '200px')};
  height: ${(props) => (props.$isDisabledVideo ? '100px' : '200px')};
  background-color: ${(props) => (props.$isDisabledVideo ? 'gray' : 'black')};
  transform: translateZ(0);
  display: ${(props) => (props.$isDisabledVideo ? 'none' : 'block')}; 
`;


const UserLabel = styled.p<VideoContainerProps>`
	display: inline-block;
	position: absolute;
	top: ${(props) => (props.$isDisabledVideo ? '80px' : '180px')};
	left: 0px;
`;

interface Props {
	studentId: string;
	//socketID: string;
	stream: MediaStream;
	muted?: boolean;
	isDisabledVideo?: boolean; // <kau> added 
}

const Video = ({ studentId,  stream, muted, isDisabledVideo }: Props) => {
	const ref = useRef<HTMLVideoElement>(null);
	const [isMuted, setIsMuted] = useState<boolean>(false);
	//console.log(`Video component for studentId: ${studentId}, muted: ${muted}, isDisabledVideo: ${isDisabledVideo}`);
	useEffect(() => {
		if (muted) setIsMuted(true);
	}, [muted]);

	useEffect(() => {
		const video = ref.current;
		if (!video || !stream) return;

		video.srcObject = stream;
		// <kau> added for iOS compatibility	
		(video as any).playsInline = true;

		video.muted = isMuted;

		const playVideo = () => {
			video.play().catch((err) => {
				console.warn('Autoplay error:', err);
			});
		};

		video.onloadedmetadata = playVideo;

		// <kau> iOS autoplay fallback
		const touchPlay = () => {
			video.play().catch(() => {});
		};
		document.addEventListener('touchstart', touchPlay, { once: true });

		return () => {
			document.removeEventListener('touchstart', touchPlay);
		};
	}, [stream]);

	return (
  <Container $isDisabledVideo={isDisabledVideo}>
    <VideoContainer
      ref={ref}
      muted={isMuted}
      $isDisabledVideo={isDisabledVideo}
     />
    <UserLabel $isDisabledVideo={isDisabledVideo}>{studentId}</UserLabel>
  </Container>
);

};

export default Video;





// Original code before modifications




// import React, { useEffect, useRef, useState } from 'react';
// import styled from 'styled-components';

// const Container = styled.div`
// 	position: relative;
// 	display: inline-block;
// 	width: 240px;
// 	height: 270px;
// 	margin: 5px;
// `;

// const VideoContainer = styled.video`
// 	width: 240px;
// 	height: 240px;
// 	background-color: black;
// `;

// const UserLabel = styled.p`
// 	display: inline-block;
// 	position: absolute;
// 	top: 230px;
// 	left: 0px;
// `;

// interface Props {
// 	email: string;
// 	stream: MediaStream;
// 	muted?: boolean;
// }

// const Video = ({ email, stream, muted }: Props) => {
// 	const ref = useRef<HTMLVideoElement>(null);
// 	const [isMuted, setIsMuted] = useState<boolean>(false);

// 	useEffect(() => {
// 		if (ref.current) ref.current.srcObject = stream;
// 		if (muted) setIsMuted(muted);
// 	}, [stream, muted]);

// 	return (
// 		<Container>
// 			<VideoContainer ref={ref} muted={isMuted} autoPlay />
// 			<UserLabel>{email}</UserLabel>
// 		</Container>
// 	);
// };

// export default Video;
